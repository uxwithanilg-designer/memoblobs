# Momo Jelly Jam — game plan

> **Status:** plan for review (2026-11-18). Nothing is built yet: implementation starts after the plan is approved.

**One line:** squish same-colour jelly pieces together into perfect blocks and send each block out through the gate of
its colour and exact size — 400 puzzle concepts across 20 worlds, then an endless Fusion Jam that keeps mixing them
into brand-new puzzles forever.

**Name:** Momo Jelly Jam (slug `momo-jelly-jam`). Tagline: *"Squish it. Fit it. Pop it out!"*
(Not "Gloop …": the site already has Gloop Guard and Gloop Pipes.)

---

## 1. What the reference video shows

The attached ad is a drag-and-fit block puzzle on one board:

- A grid tray with a frame, inner walls in later levels, and **coloured gates** on the frame, each with an arrow.
- **Glossy jelly pieces** (bars and L-shapes) in several colours. You drag a piece; it slides through free cells.
- **Same-colour pieces join** when you place them so together they form a solid rectangle (two Ls → a 4×2 block, two
  bars side by side → a 2×3 block).
- **"Shapes must be the same size as the exit"**: a block can leave only through a gate of its colour whose width is
  exactly the block's side. It then slides out and disappears.
- A **turn pad** (purple, with a uses counter 3 → 2 …) turns a piece 90° when you drop it on it.
- Level complete when every piece is out. The end card hints at bigger boards with several turn pads.

**What we keep:** the genre's core idea — drag, join same colours into rectangles, fit the exact gate.
**What we do not copy:** the name, logo, art, board look, characters or any level. Everything below — the world, the
characters, the 3D jelly look, all 400 concepts, every level (built by our own generator) — is original MOMOBLOBS work.

## 2. How Jelly Jam is better

| The ad game | Momo Jelly Jam |
| --- | --- |
| A few mechanics, hand-made levels | **400 puzzle concepts**, a new one every 3 levels for 1,200 levels |
| Levels run out | **Endless Fusion Jam** after 400: concepts mix into new named concepts (#401, #402 …) forever |
| Same-looking boards | 20 themed worlds, 36 board silhouettes, a level rhythm that never feels samey |
| Flat glossy look | **Real 3D wobbly jelly** with faces that blink, look where you drag, hug when they join, wave bye at the gate |
| No story | Momo, Bonbon & friends run the Jelly Express; Kranky jams the factory and is the boss of every world |
| Unknown fairness | **Every level is built backwards from a solution and checked by a solver** → always solvable, fair par, real hints |
| Ads | No ads, no paid boosters. Coins, stars and helpers are earned by playing. Shared MOMOBLOBS coin jar |

## 3. The core rules (exact)

1. **Board:** a grid (4×5 up to 10×14) with a frame, walls, floor tiles and **gates** on the frame (later also inside).
2. **Jellies:** polyomino pieces with a colour. Drag one with a finger: it follows your finger cell by cell through free
   cells only (no jumping over anything), and drops where you let go. A ghost shows where it will land.
3. **Squish:** when you drop a jelly so it touches same-colour jellies and together they make a **solid rectangle**, they
   squish into one block (*bloop!*). They do not squish if the union is not a rectangle.
4. **Send out:** a block that touches its colour's gate with a side **exactly as wide as the gate** (and lined up with
   it) slides out by itself. Wrong colour or wrong size: the gate stays shut and wobbles "no".
5. **Win:** every jelly out (unless a level's goal says otherwise). **Stars:** 3★ at par moves, 2★ at par + 25 %, 1★ any.
6. **Undo** is free (except in a few "no undo" concept levels). A move = one drag.

## 4. Look, sound, feel

- **Real 3D (three.js)**, like Momo Escape's new look: a toy tray on a themed table, soft key light with real shadows,
  glossy see-through jelly (clearcoat + sheen + subsurface tint) that **wobbles** on spring physics when grabbed,
  dropped, squished or bumped.
- **Jellies have tiny faces**: they blink, look toward your finger, squint when blocked, hug and melt together when
  they squish, and wave goodbye as they slide out through the gate. Big blocks get bigger, happier faces.
- **Gates** are glowing chutes with the friend who receives that colour (Momo orange, Bonbon pink, Pip blue, Gloop
  green, Zib purple, Tiki teal…), and a size marker on the chute (dots = cells).
- **ASMR-satisfying sounds**: squelch on grab, slide swish, *bloop* on squish (pitch by block size), *pop* out the
  gate, combo chimes, world music per theme on the MOMOBLOBS music engine. Haptics on phones.
- **Phone-app feel:** full-bleed portrait board, one-finger drag, big Undo/Hint buttons at thumb height, no tiny text.
- **Colour-blind safe:** every colour also has a symbol on the jelly and the gate (★ ● ▲ ■ ♥ ✚).

## 5. Controls

- **Phone / mouse:** drag a jelly. Drop it on a turn pad to turn it. Tap Undo / Hint.
- **Keyboard:** Tab / arrows to pick a jelly, Space to grab, arrows to move, Space to drop, Z undo, H hint.

## 6. Journey: 20 worlds × 60 levels = 1,200 levels, a new concept every 3 levels

- Each world introduces **20 concepts** (its own world concept + 19 puzzle mechanics) → 20 × 20 = **400 concepts**.
- **Level rhythm (every 10 levels):** 1 Meet (new concept, gentle) · 2 Use · 3 Mix (with older concepts) · 4 Meet ·
  5 Use · 6 Breather (easier, coins) · 7 Meet · 8 Twist (hard mix) · 9 Brain Burner (hardest of the ten) · 10 Star
  Level (bigger board, bonus). Level 60 of every world is a **Kranky boss** level.
- **Difficulty climbs** on every axis, in a sawtooth so there is always a breather after a hard one:

| Axis | World 1 | World 10 | World 20 |
| --- | --- | --- | --- |
| Board | 5×6 | 8×10 | 10×14 |
| Colours | 2 | 4–5 | 6 |
| Pieces | 3–5 | 8–12 | 12–18 |
| Parts per block | 2 | 2–4 | 2–6 |
| Par (moves) | 4–8 | 12–22 | 20–40 |
| Dead ends | none | some | many (needs planning) |
| "Aha" moves (moves that look wrong but are needed) | 0 | 1–2 | 2–4 |

## 7. After 400: the endless Fusion Jam

- From level 1,201 the **Fusion Director** builds every level from **2–4 concepts mixed together** out of all 400
  (a compatibility table stops nonsense mixes, e.g. two different gravity rules).
- **Novelty first:** it scores each candidate mix by how long ago you saw its concepts and pairs, and picks fresh ones.
- **Named & collected:** every new mix gets a name built from its parts (e.g. *Frosty Belt Rush*, *Ghost Gate Bloom*)
  and a new card in the Concept Dex: #401, #402, … forever.
- **Never repeats:** each level has a fingerprint (board silhouette + piece set + gate layout + concepts); the last
  3,000 fingerprints you played are never reused. 36 silhouettes × piece sets × gates × mixes × seeds = effectively
  unlimited.
- **Keeps getting tougher:** after the board size cap (phone readability) difficulty grows through deeper solutions,
  more dead ends, more "aha" moves and tighter limits — still in the sawtooth rhythm.

## 8. Fair levels, always (generator + solver)

1. **Build backwards from a solution:** start with an empty board and its gates → place finished blocks at their gates
   → "un-send" them inside → "un-squish" each block into 2–6 pieces → scramble with legal reverse moves, honouring the
   level's concepts. A level built this way always has a solution.
2. **Solve forwards (A\*)** in a Web Worker: finds par (fewest moves), counts dead ends and "aha" moves → a difficulty
   score. Levels that are too easy or too hard for their slot are rebuilt (like Momo Escape's builder).
3. **Hints** come from the same solver: the next best move from wherever the player is now.
4. **QA sweeps** (headless, like Momo Escape's): build all 1,200 journey levels + 500 fusion levels, check 100 %
   solvable, build time, difficulty curve, no duplicates.

## 9. Modes

- **Journey** — 20 worlds, 1,200 levels, then the endless Fusion Jam.
- **Daily Jam** — 3 puzzles a day (easy / medium / hard), same for everyone, streak counter.
- **Endless Jam** — Fusion levels from any time after world 3, for players who want only mixes.
- **Rush** — solve as many small boards as you can in 3 minutes.
- **Zen** — no move limits, no timers, no fail, calm music.
- **Kranky Weekly** — a weekly boss tower (3 stacked boards).
- **Jam Lab** — pick up to 3 concepts you have met, a board size and a difficulty → play, and share the level code.
- **Puzzle Packs** — themed 30-level packs: *Only Bars*, *Pure Shapes* (one colour), *Ice Rink*, *Teleport Maze*…

## 10. Rewards & progress

- Stars per level, coins (shared MOMOBLOBS coin jar with the site and the other games), world map with Momo walking.
- **Concept Dex:** 400 cards + every fusion card you discover.
- **Jelly Shop (cosmetic only):** jelly skins (glossy, glitter, galaxy, candy-stripe, lava-lamp), face styles, tray
  skins, gate friends. Paid with earned coins.
- **Helpers** (section 11, H) are earned with stars; never bought with money.

---

## 11. The 400 concepts

IDs are fixed (the code will use them). 14 groups: B boards (30) · P shapes (30) · F squish rules (30) · G gates (35) ·
T floor tiles (40) · M machines (30) · O obstacles (35) · J special jellies (35) · C colour tricks (25) · R rules &
goals (30) · S space & physics (25) · K Kranky bosses (20) · H helpers (15) · W worlds (20) = **400**.

### B — Boards & walls (30)
- **B01 Open Tray** — a plain board with no inner walls; learn to drag, squish and send out.
- **B02 Divider** — one inner wall splits the board into two lanes.
- **B03 Two Rooms** — two zones joined by a single gap.
- **B04 Corridor** — 1-wide corridors that only bars fit through.
- **B05 Posts** — single-cell posts that stop a slide.
- **B06 Notched Frame** — notches near gates block wide jellies from lining up.
- **B07 Hourglass** — a narrow waist: big blocks must be built on the right side.
- **B08 Cross Board** — a plus-shaped board.
- **B09 Donut** — a solid hole in the middle; jellies travel around it.
- **B10 Stair Edge** — a stepped outline only some shapes can hug.
- **B11 Parking Pocket** — a dead-end pocket to park a jelly while you work.
- **B12 Window** — a 1-cell window in a wall: only thin parts pass.
- **B13 Edge Rails** — thin rails on cell edges block moves between two cells.
- **B14 Rail Maze** — a maze made only of edge rails.
- **B15 Big Tray** — 9×12 and up: more pieces, more planning.
- **B16 Tiny Tray** — 4×5: every cell counts.
- **B17 Twin Trays** — two boards side by side joined by a tunnel.
- **B18 Pits** — a jelly dropped over a pit falls in (undo or retry).
- **B19 Narrow Bridge** — a bridge over pits that only 1-wide jellies can cross.
- **B20 Cut Corners** — cut corners steal space from corner gates.
- **B21 Spiral** — a spiral corridor to the centre.
- **B22 Maze Board** — a full maze: route-planning puzzles.
- **B23 Blink Wall** — a wall that is there on odd moves and gone on even moves.
- **B24 Shrinking Tray** — the frame closes in one row every N moves.
- **B25 Growing Tray** — new rows unlock after the first block leaves.
- **B26 Inner Gate Wall** — gates on inner walls, not just the frame.
- **B27 L-Tray** — an L-shaped board.
- **B28 Islands** — zones joined only by teleport pads.
- **B29 Dark Rooms** — rooms stay hidden until a jelly enters.
- **B30 Echo Tray** — two mirrored halves: a move in one half is copied in the other.

### P — Jelly shapes (30)
- **P01 Bar** — straight 1×n jellies.
- **P02 Square** — 2×2 cubes.
- **P03 L** — the classic corner piece.
- **P04 Mirror L** — L pieces that only fit after a flip.
- **P05 T** — T pieces that need a partner to square up.
- **P06 S & Z** — zig-zag pieces.
- **P07 Plus** — a cross-shaped jelly.
- **P08 U** — a cup shape that needs a plug.
- **P09 Big Corner** — a 3×3 corner L.
- **P10 Domino** — 1×2 pairs.
- **P11 Drop** — single 1×1 jellies.
- **P12 Long Bar** — 1×5 and 1×6 bars that block whole lanes.
- **P13 Steps** — a staircase shape.
- **P14 Ring** — a hollow square that needs a filler in its hole.
- **P15 Comb** — an E-shape with teeth.
- **P16 Hook** — a J with a long tail.
- **P17 Fat T** — a 3-wide T.
- **P18 Pentomino Party** — random 5-cell shapes.
- **P19 Giant Pieces** — 6–8 cell shapes.
- **P20 One-Way Pair** — two pieces that square up in only one placement.
- **P21 Three-Part** — three pieces make one block.
- **P22 Four-Part** — four pieces make one block.
- **P23 Fillers** — tiny drops that patch gaps in a block.
- **P24 Loner** — a jelly with no partner; it must fit its gate as it is.
- **P25 Spare Part** — an extra piece that leaves by a small side gate.
- **P26 Wrap-Around** — a piece curled around another colour: free the inner one first.
- **P27 Interlock** — two colours locked like puzzle teeth: slide them apart in the right order.
- **P28 Twins** — mirror-image pieces of one colour.
- **P29 Big Build** — a 3×5 or 4×4 gate that needs five or more pieces.
- **P30 Two Sizes** — one colour, two gates of different sizes: build two different blocks.

### F — Squish rules (30)
- **F01 Squish** — same colour + together a solid rectangle → one block (the core rule).
- **F02 Blob Squish** — same colours squish on any touch into any shape; only rectangles can leave.
- **F03 Part Counter** — a block shows how many parts it holds.
- **F04 One-Squish** — some jellies can squish only once.
- **F05 Glue Spot** — squishing only works on glue tiles.
- **F06 Warm Squish** — squishing only works on warm tiles.
- **F07 No-Squish Zone** — tiles where jellies can't squish (a safe parking spot).
- **F08 Slow Set** — a squish finishes one move later.
- **F09 Chain Squish** — a squish pulls in every touching same-colour piece that completes a rectangle.
- **F10 Unsquish Pad** — splits a block back into its parts.
- **F11 Cutter Line** — a laser line cuts a crossing block in two.
- **F12 Colour Mix** — red + blue squish into purple and need a purple gate.
- **F13 Two Ways** — two bars can make a 2×2 or a 1×4: pick the one the gate wants.
- **F14 Too Big** — squishing everything makes a block too big: hold one piece back.
- **F15 Exact Size** — some gates check length too: the block must be exactly W × L.
- **F16 Squish Arrows** — arrow jellies squish only along their arrow's axis.
- **F17 Magnet Pull** — same colours in a clear line slide together.
- **F18 Push Away** — opposite-colour magnets push each other away.
- **F19 Lock Squish** — squishing a marked pair opens a door.
- **F20 Setting Jelly** — a block turns to stone if it doesn't leave within 3 moves.
- **F21 Bubble Wrap** — a wrapped piece can't squish until its bubble pops.
- **F22 Stuck Pair** — two different colours stuck together until a splitter.
- **F23 Spin Squish** — a fresh block turns 90°.
- **F24 Press** — a press tile squeezes any blob into a rectangle of the same area.
- **F25 Area Gate** — the gate takes any block of the right area and width.
- **F26 Together** — two blocks must leave in the same move through twin gates.
- **F27 Gobble** — a hungry jelly eats drops to grow.
- **F28 Melt** — a jelly on a hot tile loses one cell per move.
- **F29 Swell** — a jelly on a water tile grows one cell per move.
- **F30 Copy Pad** — copies a jelly (now both need a way out).

### G — Gates (35)
- **G01 Gate** — a colour and a width; the block's side must match exactly.
- **G02 Wide Gate** — 3 to 5 wide.
- **G03 Slot** — a 1-wide gate for bars and drops.
- **G04 Two Sizes, One Colour** — two gates of one colour with different widths.
- **G05 Inner Gate** — a gate in the middle of a wall.
- **G06 Locked Gate** — needs a key.
- **G07 Count Gate** — closes after N blocks.
- **G08 Blink Gate** — open every other move.
- **G09 One-Time Gate** — closes after one block.
- **G10 Mix Gate** — takes two or three listed colours.
- **G11 Rainbow Gate** — takes any colour.
- **G12 Stone Gate** — only stone jellies.
- **G13 Sliding Gate** — moves along its edge after every move.
- **G14 Hopping Gate** — jumps to the next side every 3 moves.
- **G15 Colour Cycle** — the gate's colour changes every move.
- **G16 Size Cycle** — the gate's width cycles 1-2-3.
- **G17 Hidden Gate** — appears when a switch is pressed.
- **G18 Numbered Gates** — use gate 1 before gate 2.
- **G19 Shared Gate** — two colours take turns.
- **G20 Corner Gate** — takes blocks from two sides.
- **G21 Arrow Gate** — the block must arrive moving in the arrow's direction.
- **G22 Coin Gate** — pay coins collected in the level.
- **G23 Fake Gate** — one of Kranky's painted fakes: the block bounces back.
- **G24 Portal Gate** — sends the block to another spot instead of out.
- **G25 Return Gate** — the block comes back one size smaller.
- **G26 Narrowing Gate** — gets one smaller after every use.
- **G27 Deep Gate** — checks length as well as width.
- **G28 Echo Gate** — sending a block out spawns its twin at the mirror gate.
- **G29 Guarded Gate** — a Grumpy sits there until his colour leaves elsewhere.
- **G30 Drain** — a gate in the middle of the floor.
- **G31 Last Gate** — opens only when everything else is out.
- **G32 Star Gate** — earns a star if used within par.
- **G33 Weight Gate** — takes exactly N parts (count badge).
- **G34 Spawner** — after a block leaves, a new jelly drops in.
- **G35 Queue Gate** — shows a colour order: red, then blue, then red.

### T — Floor tiles (40)
- **T01 Turn Pad** — turns a jelly 90° (limited uses).
- **T02 Back Turn** — turns the other way.
- **T03 Flip Pad** — flips a jelly like a mirror.
- **T04 Ice** — a jelly slides until it hits something.
- **T05 Sticky Mud** — a jelly stops the moment it enters.
- **T06 Belt** — after each move, jellies on it shift one cell.
- **T07 One-Way Arrows** — cross only in the arrow's direction.
- **T08 Teleport Pair** — enter one, come out of the other.
- **T09 Switch** — toggles doors on and off.
- **T10 Pressure Plate** — a door stays open only while something sits on it.
- **T11 Paint Splash** — recolours a jelly.
- **T12 Rinse** — washes a jelly clear; it needs paint before it can leave.
- **T13 Shrink Pad** — shrinks a jelly by one row.
- **T14 Stretch Pad** — grows a jelly by one row.
- **T15 Split Pad** — splits a jelly in half.
- **T16 Bumper** — bounces a jelly back one cell.
- **T17 Spring** — launches a jelly across the board.
- **T18 Bubble Pad** — wraps a jelly in a bubble.
- **T19 Stars** — pick up stars on the way.
- **T20 Coins** — coins on the floor.
- **T21 Key** — a key to collect.
- **T22 Crumble** — can be crossed once, then becomes a pit.
- **T23 Glass** — breaks on the second crossing.
- **T24 Gear** — a 2×2 spot that turns with whatever sits on it, every move.
- **T25 Swap Pair** — jellies on two marked tiles swap places.
- **T26 Counter** — counts down as jellies cross; at 0 it becomes a wall.
- **T27 Snare** — a jelly that stops here is stuck for 2 moves.
- **T28 Magnet Tile** — pulls neighbours one cell.
- **T29 Wind Lane** — every move, jellies in the lane drift one cell.
- **T30 Lift** — moves up and down a column with its passenger.
- **T31 Colour Filter** — only one colour may cross.
- **T32 Size Filter** — only jellies up to N wide may cross.
- **T33 Toll** — crossing costs one level coin.
- **T34 Fog** — hides what's under it.
- **T35 Lamp** — lights the fog around it.
- **T36 Target Tiles** — cover them all before the last gate opens.
- **T37 Wash Bay** — dirty jellies must be washed before they leave.
- **T38 Charger** — charges a battery jelly.
- **T39 Bomb Tile** — blows up nearby walls after N moves.
- **T40 Rewind Trap** — sends a jelly back to where it started.

### M — Machines (30)
- **M01 Piston** — pushes a row every 2 moves.
- **M02 Crusher** — closes a cell every few moves (don't park there).
- **M03 Turntable** — a 3×3 plate that turns 90° each move.
- **M04 Drag Wall** — a wall on a rail you can drag too.
- **M05 Crate** — a box jellies can push.
- **M06 Cart** — a cart on a track carries a jelly.
- **M07 Crane** — moves one jelly to the far side when its button is pressed.
- **M08 Lift Platform** — raises a jelly through a floor.
- **M09 Fan** — blows jellies away.
- **M10 Vacuum** — pulls jellies in.
- **M11 Gate Lever** — swaps two gates' places.
- **M12 Clock Arm** — a wall arm that ticks round each move.
- **M13 Rolling Ball** — rolls one cell every move.
- **M14 Patrol Grumpy** — walks a lane and blocks it.
- **M15 Revolving Door** — turns when pushed.
- **M16 Drawbridge** — a switch lowers a bridge over a pit.
- **M17 Gumball Machine** — drops a new drop jelly.
- **M18 Mixer** — two jellies in, one mixed colour out.
- **M19 Stamp Press** — presses a blob into a rectangle.
- **M20 Laser Cutter** — slices a jelly that crosses it.
- **M21 Pipes** — a jelly goes in one pipe end and out the other.
- **M22 Shuffler** — swaps the colours of jellies on its pads every 3 moves.
- **M23 Loop Belt** — a belt ring that keeps jellies circling.
- **M24 Seesaw** — weight on one end lifts walls on the other.
- **M25 Fuse Wall** — a wall that burns away after N moves.
- **M26 Row Slider** — a lever slides a whole row one cell.
- **M27 Quarter Spin** — a quarter of the board turns.
- **M28 Wheel Gate** — a gate on a spinning wheel.
- **M29 Freezer** — freezes the nearest jelly every N moves.
- **M30 Helper Bot** — Bolt nudges a chosen jelly one cell after each of your moves.

### O — Obstacles & locks (35)
- **O01 Ice Block** — a frozen jelly: thaw it by squishing next to it or with heat.
- **O02 Chain** — needs the key of its colour.
- **O03 Number Lock** — opens after N blocks have left.
- **O04 Crate Stack** — breaks when a 3+ cell jelly hits it.
- **O05 Stone** — immovable until a bomb.
- **O06 Glass Block** — breaks after two hits.
- **O07 Rope** — two jellies tied together move as one.
- **O08 Thorns** — pop bubbles.
- **O09 Goo Puddle** — stuck for one move.
- **O10 Sitting Grumpy** — leaves when his colour gets out.
- **O11 Cage** — a jelly locked in a cage.
- **O12 Vines** — grow one cell each move; a cutter clears them.
- **O13 Shield** — a bubble shield on a gate.
- **O14 Red/Blue Blocks** — colour walls that swap when a switch is hit.
- **O15 Boulder** — rolls when pushed and doesn't stop.
- **O16 Laser Fence** — blocks a lane until switched off.
- **O17 Smoke** — hides part of the board.
- **O18 Sleepy Grumpy** — wakes after N moves and walks.
- **O19 Mud Splash** — dirties jellies that touch it.
- **O20 Tape** — holds two cells until a block leaves nearby.
- **O21 Heavy Load** — a weight that lets its jelly move only one cell per drag.
- **O22 Popcorn** — kernels pop into blockers after N moves.
- **O23 Balloon** — floats away when a block leaves next to it.
- **O24 Snowball** — grows as it rolls.
- **O25 Gum Wall** — push through, but stay stuck one move.
- **O26 Zap Fence** — on and off every move.
- **O27 Key Ring** — several keys and locks in colours.
- **O28 Hidden Switch** — under a jelly at the start.
- **O29 Trap Door** — closes behind a jelly: no way back.
- **O30 Bouncer** — throws a jelly back to where it came from.
- **O31 Totem** — jellies must pass it in colour order.
- **O32 Honey** — leaving takes two moves.
- **O33 Dominoes** — knock one down and the row falls.
- **O34 Tangle** — two colours knotted: separate them in order.
- **O35 Code Lock** — the order of colours sent out is the code.

### J — Special jellies (35)
- **J01 Rainbow** — any colour; squishes with anyone.
- **J02 Stone** — never squishes; leaves by the stone gate.
- **J03 Bubble** — floats over pits.
- **J04 Heavy** — one cell per drag.
- **J05 Bouncy** — slides until it hits something.
- **J06 Sticky** — drags its neighbours along.
- **J07 Chameleon** — takes the colour of the last jelly it touched.
- **J08 Countdown** — must leave within N moves.
- **J09 Shy** — scoots away when another jelly comes close.
- **J10 Contrary** — moves the opposite way you drag.
- **J11 Twins** — two jellies that copy each other's moves.
- **J12 Ghost** — passes through walls, not jellies.
- **J13 Glow** — lights the fog around it.
- **J14 Number** — needs exactly N parts.
- **J15 Baby** — a drop that grows every move until 2×2.
- **J16 Lazy** — moves only every other turn.
- **J17 Bomb** — pops after N moves and clears crates nearby.
- **J18 Frost** — freezes the floor it rests on into ice.
- **J19 Paintball** — paints the jelly it squishes with.
- **J20 Magnet** — pulls its own colour.
- **J21 Key Jelly** — opens a lock it touches.
- **J22 Hungry** — eats drops to grow.
- **J23 Splitter** — splits in two when it hits a wall.
- **J24 Spinner** — turns 90° every move.
- **J25 Arrow** — moves only in its arrow's direction.
- **J26 Rail** — moves only along one axis.
- **J27 Coin Jelly** — a bonus jelly that can leave by any gate.
- **J28 Star Jelly** — send it out for a star.
- **J29 King** — must leave last.
- **J30 Leader** — others of its colour follow its moves.
- **J31 Fragile** — cracks into drops after 3 moves.
- **J32 Stretchy** — stretches to fill a gap.
- **J33 Copycat** — repeats your last move.
- **J34 Sleepy** — needs a nudge to wake.
- **J35 Kranky's Jelly** — an enemy jelly that moves after you to block.

### C — Colour tricks (25)
- **C01 Two Colours** · **C02 Three Colours** · **C03 Four Colours** · **C04 Five Colours** · **C05 Six Colours**.
- **C06 Shades** — light red and dark red are different colours.
- **C07 Symbols** — every colour also has a symbol (always on for colour-blind play).
- **C08 Mixing** — red + yellow = orange.
- **C09 Unmixer** — a machine splits a mixed colour back.
- **C10 Gold Rush** — a block of 4+ parts turns gold for a bonus.
- **C11 Night Glow** — colours only show under lamps.
- **C12 Mystery Grey** — a colour hidden until touched.
- **C13 Swap Switch** — all reds ↔ blues.
- **C14 Two-Tone** — half red, half blue: split it before it can leave.
- **C15 Stripes** — fits either of two gate colours.
- **C16 Colour Order** — colours must leave in the shown order.
- **C17 Rainbow Floor** — tiles that cycle colours.
- **C18 Paint Bucket** — limited paint uses.
- **C19 Stains** — jellies stain the floor; stains paint other jellies.
- **C20 Clash** — red and green can't touch.
- **C21 Black & White** — shapes only, no colours.
- **C22 Neon** — dark board, glowing jellies.
- **C23 Colour Count** — send 3 blues before any red.
- **C24 Tones** — same colour, different tones: squishing makes it lighter.
- **C25 One Colour** — everything one colour: a pure shape puzzle.

### R — Rules & goals (30)
- **R01 Clear Out** — all jellies out (the default).
- **R02 Move Limit** — finish within N moves.
- **R03 Par Stars** — 3 stars at par.
- **R04 Exit Order** — numbered jellies leave in order.
- **R05 Colour Order** — colours leave in order.
- **R06 Some Out** — only marked jellies must leave.
- **R07 Keep One** — one jelly must stay.
- **R08 Star Trail** — collect stars on the way.
- **R09 Rush** — a timer.
- **R10 No Undo** — think first.
- **R11 One Turn** — only one turn-pad use in the whole level.
- **R12 One Drag Each** — every jelly may be moved only once.
- **R13 Build First** — squish everything before any block leaves.
- **R14 Big Finish** — all blocks leave in one combo.
- **R15 Picture** — arrange jellies into a picture instead of sending them out.
- **R16 Pack It** — fit every jelly into a marked box (a packing puzzle).
- **R17 Copy Me** — match a target layout.
- **R18 Sort** — move each colour into its zone.
- **R19 Exact Par** — solve in exactly par moves.
- **R20 Peek** — see the board for 5 s, then fog.
- **R21 Remember Gates** — gate colours hide after a preview.
- **R22 No Touch** — jellies of different colours must never touch.
- **R23 Combo** — blocks must leave within 2 moves of each other.
- **R24 Two Boards** — finish board A, then board B with what's left.
- **R25 Survive** — Kranky drops a jelly every 5 moves.
- **R26 Coin Route** — bonus coins off the fast path.
- **R27 Undo Costs** — undos spend coins.
- **R28 Three Lives** — three falls and you retry.
- **R29 Pure** — no turn pads allowed.
- **R30 Twist** — halfway through, the rules change (the board flips).

### S — Space & physics (25)
- **S01 Gravity** — after each move jellies fall down.
- **S02 Gravity Arrows** — tiles change the fall direction.
- **S03 Tilt** — a button tilts the tray; everything slides.
- **S04 Wrap** — leave one edge, come back on the other.
- **S05 Upside Down** — the tray flips every N moves.
- **S06 Spin Tray** — the tray turns 90° every N moves.
- **S07 Float** — jellies drift up after each move.
- **S08 Water Line** — jellies float on a rising water layer.
- **S09 Slippery** — the whole board is ice.
- **S10 Magnetic Field** — jellies drift toward one side.
- **S11 Current** — a stream carries jellies along a lane.
- **S12 Quake** — walls shuffle every 5 moves.
- **S13 Black Hole** — pulls the nearest jelly one cell each move.
- **S14 Zero-G** — a dragged jelly keeps moving until it hits something.
- **S15 Bouncy Walls** — jellies bounce off walls back one cell.
- **S16 Edge Portals** — matching marks on the frame connect.
- **S17 Bridges** — an upper layer jellies can pass over.
- **S18 Torus** — wrap on both axes.
- **S19 Mirror Input** — drag left, it goes right.
- **S20 Delay** — moves happen one turn later.
- **S21 Echo Moves** — every move is repeated once.
- **S22 Time Loop** — the board resets every N moves, except blocks already out.
- **S23 Crowd** — moving a jelly moves every other jelly of its colour the same way.
- **S24 Settle** — a jelly resting 2 moves sticks to the floor.
- **S25 Big Wobble** — dropping a big block shakes small ones one cell.

### K — Kranky bosses & sabotage (20)
- **K01 Colour Swap** — Kranky swaps two jellies' colours mid-level.
- **K02 Wall Drop** — he drops a wall where you were heading.
- **K03 Paint Bomb** — he splashes a colour over part of the board.
- **K04 Freeze Ray** — he freezes a jelly every few moves.
- **K05 Jelly Thief** — he cages a jelly; rescue it.
- **K06 Fake Gates** — painted fake gates among the real ones.
- **K07 Gate Shuffle** — he shuffles the gates mid-level.
- **K08 Clock Boss** — beat his clock.
- **K09 Grumpy Army** — Grumpies block lanes and move.
- **K10 Mirror Trick** — the board mirrors halfway.
- **K11 Bomb Run** — clear the bombs before they pop.
- **K12 Chaser Robot** — his robot jelly chases yours.
- **K13 Smoke Screen** — the board goes dark in patches.
- **K14 Belt Maze** — his conveyor maze.
- **K15 Code Safe** — send colours out in his safe's code.
- **K16 Giant Jelly** — a 6-part monster block.
- **K17 Last Gate Block** — he sits on the last gate; trick him away.
- **K18 Duel** — turn-based: he moves a jelly after each of yours.
- **K19 Tower Boss** — three stacked boards.
- **K20 Fortress Finale** — all his tricks at once.

### H — Helpers (15) — earned with stars, never bought
- **H01 Undo** · **H02 Hint** (the solver's next move) · **H03 Bonbon Squish** (squish two same-colour pieces anywhere) ·
  **H04 Momo Push** (moves one blocker) · **H05 Extra Turn** (+1 turn-pad use) · **H06 Extra Moves** (+5) ·
  **H07 Tiki Peek** (clears fog) · **H08 Paint Brush** (recolour one jelly) · **H09 Pip Freeze** (stops timers 10 s) ·
  **H10 Zib Beam** (teleport a jelly to any free spot) · **H11 Bolt Magnet** (pulls a block to its gate if the way is
  clear) · **H12 Hammer** (breaks one crate or stone) · **H13 Gloop Sponge** (soaks up a puddle or fills a pit) ·
  **H14 Hoot Rewind** (rewinds 5 moves) · **H15 Turbo Reroll** (rebuilds a stuck level with the same concepts).

### W — Worlds (20) — each with its own look, music and signature concepts
| # | World | Signature concepts (examples) |
| --- | --- | --- |
| W01 | Jelly Kitchen | B01 Open Tray, F01 Squish, G01 Gate, P01–P03, T01 Turn Pad |
| W02 | Candy Factory | T06 Belt, M17 Gumball Machine, P10 Domino, G07 Count Gate |
| W03 | Toy Workshop | M05 Crate, O04 Crate Stack, B05 Posts, P21 Three-Part |
| W04 | Ice-Cream Parlour | T04 Ice, O01 Ice Block, J18 Frost, S09 Slippery |
| W05 | Bubble Bath | J03 Bubble, T18 Bubble Pad, O08 Thorns, S08 Water Line |
| W06 | Greenhouse | O12 Vines, F29 Swell, J15 Baby, T30 Lift |
| W07 | Clock Shop | M12 Clock Arm, T24 Gear, B23 Blink Wall, J08 Countdown |
| W08 | Robot Lab | M30 Helper Bot, T38 Charger, M07 Crane, J30 Leader |
| W09 | Pirate Galley | S03 Tilt, S11 Current, O27 Key Ring, G18 Numbered Gates |
| W10 | Space Pantry | S01 Gravity, S14 Zero-G, S13 Black Hole, T08 Teleport Pair |
| W11 | Haunted Pantry | J12 Ghost, T34 Fog, B29 Dark Rooms, G23 Fake Gate |
| W12 | Volcano Bakery | F28 Melt, T39 Bomb Tile, J17 Bomb, M25 Fuse Wall |
| W13 | Music Box | B30 Echo Tray, S21 Echo Moves, J33 Copycat, M28 Wheel Gate |
| W14 | Art Studio | F12 Colour Mix, T11 Paint Splash, C08 Mixing, C19 Stains |
| W15 | Snow Lodge | O24 Snowball, M29 Freezer, O15 Boulder, B24 Shrinking Tray |
| W16 | Desert Market | T05 Sticky Mud, T33 Toll, G22 Coin Gate, M06 Cart |
| W17 | Neon Arcade | C22 Neon, F17 Magnet Pull, J20 Magnet, O26 Zap Fence |
| W18 | Jelly Reef | S08 Water Line, M21 Pipes, J09 Shy, S16 Edge Portals |
| W19 | Sky Bakery | S07 Float, T29 Wind Lane, M09 Fan, B19 Narrow Bridge |
| W20 | Kranky's Jelly Fortress | J35 Kranky's Jelly, K-bosses, every group mixed |

(The exact 20-per-world teaching order lives in a data file in the code, like Momo Escape's building schedule.)

---

## 12. Tech plan (same shape as Momo Escape)

- `src/jelly/types.ts` — board, cells, walls, gates, tiles, jellies (polyominoes + colour + flags), concept ids.
- `src/jelly/rules.ts` — one deterministic rules step: drag path, squish (rectangle test), send-out, every tile,
  machine and jelly behaviour (used by the game, the solver and the generator).
- `src/jelly/solver.ts` — A\* with move collapsing (a drag = any reachable drop spot), state hashing, budgets; par,
  dead ends, "aha" moves, hints.
- `src/jelly/gen.ts` — backwards builder (solved → scrambled), concept placers, difficulty targeting, 36 silhouettes.
- `src/jelly/director.ts` — journey schedule (20 worlds × 60 levels), level rhythm, the Fusion Director, fingerprints.
- `src/jelly/data/concepts.ts` (the 400) · `src/jelly/data/worlds.ts` (20 worlds, colours, music).
- `src/jelly/worker.ts` — builds and solves levels off the main thread, two levels ahead.
- `src/jelly/render3d.ts` + `src/jelly/three/models.ts` — three.js tray, wobbly glossy jelly meshes with faces, gates
  with friends, tiles, machines, particles; real shadows; quality levels for phones.
- `src/jelly/session.ts` — input (drag, keyboard), undo stack, stars, sounds, music, haptics, HUD events.
- `src/jelly/save.ts` — progress, stars, Dex, fusion memory, daily streak, shop items; shared coin jar.
- `src/jelly/ui/JellyApp.tsx` — title, world map, level screen, Modes, Dex, Shop, Lab; phone-first app feel.
- Site: `src/lib/games.ts` entry (engine `"jelly"`, 3D), play page wiring, store art from real 3D captures.

## 13. Build phases

1. **Phase 1 — the core:** rules (drag, squish, gates, turn pad), 3D wobbly jelly look with faces, generator + solver +
   hints, worlds 1–2 (concepts 1–40, levels 1–120), stars, undo, save, sounds. Playable on phones.
2. **Phase 2 — tiles, machines, obstacles:** concepts to 200, worlds 3–10.
3. **Phase 3 — special jellies, colours, rules, space twists, Kranky bosses:** concepts to 400, worlds 11–20.
4. **Phase 4 — endless & modes:** Fusion Director, Daily Jam, Endless Jam, Rush, Zen, Kranky Weekly, Jam Lab,
   Puzzle Packs, Concept Dex, Jelly Shop.
5. **Phase 5 — polish & QA:** world music, ASMR sound set, store art, headless sweep of 1,200 + 500 levels
   (100 % solvable, difficulty curve, no repeats), phone performance pass.

### Phase 1 — status (built, 2026-11-18)

What is in the game now (`src/jelly/`, engine `"jelly"`, page `/play/momo-jelly-jam`):

- **One endless run, no stage select.** The title screen shows only *Play / Continue · Stage N*. Clearing a tray goes
  straight to the next stage after the win sheet. The save (`momoblobs:jellyjam`) keeps the current stage's board and
  every move, so closing and reopening the game resumes the exact same position.
- **Worlds 1–2 taught (stages 1–120, concepts W01–W02 + 38 more)**, a new concept roughly every 3 stages with a
  "New: …" card. From stage 121 the **Fusion Jam** mixes everything learned so far into new named puzzles
  ("Giant Count Twist", "Belt Post Fizz", …) with a memory of recent mixes, so it never repeats; worlds 3–20 arrive in
  Phases 2–3 and simply extend the taught part.
- **Difficulty** rises with the stage number (`difficultyAt(n) = 0.05 + 1.1·(1 − e^(−n/180))`) plus the stage rhythm
  (meet / use / mix / breather / twist / burner / star / boss): bigger trays, more colours, more parts per block,
  pieces parked in other blocks' gate spots, walls, pads, belts and arrows.
- **Always solvable:** stages are built backwards from their solution and replayed forwards through the rules before
  they are shown; par comes from a quick solver pass. Headless sweep: stages 1–220 → 0 unsolvable, 0 spare boards;
  380–439 → 0 unsolvable, 1 spare board in 60. About 8 % of fusion stages take the "simpler take" retry (mostly
  Tiny Tray mixes).
- **Rules built:** drag through free cells, squish into rectangles, exact-width gates, turn pads (CW / CCW, limited
  uses, a pad stage always has a jelly that needs it), belts (a jelly dropped on a belt rides to its end), one-way
  arrows, wide / slot / count gates, two gates of one colour in different sizes, the **Mix Gate** (two colours share one gate — it replaces the
  blink gate in World 2), inner wall layouts.
- **3D look:** extruded rounded jelly from each piece's outline, blinking eyes that follow the finger, raised gates,
  per-world table, tray colours and props, real shadows, confetti; the room reflection is turned so colours read the
  same everywhere on the tray.
- **Sound:** music changes every stage (style, key and tempo per stage from the world's mood), squish / pop / whoosh /
  chime sounds panned left–right by where they happen, vibration on phones.
- **Phone first:** one-finger drag, HUD and buttons sized for 375 px wide screens, safe-area padding, automatic
  graphics quality; also fits tablets and desktop.
- Store art in `public/games/momo-jelly-jam/` comes from real 3D captures.

### Phases 2, 3 and 4 — status (built, 2026-11-18)

**All 20 worlds teach now** (`src/jelly/data/worlds.ts`): every world has its card, 18 ideas in teaching order and its
Kranky boss — all 400 concept ids are used exactly once, so the journey is 20 × 60 = **1,200 stages**, a new idea every
3 stages; after stage 1,200 the Fusion Jam mixes all 400.

**How the 360 new ideas are built** (`src/jelly/mech.ts`, one class per idea):

| class | what happens | examples |
|---|---|---|
| layout (≈150) | built into the board and blocks by `gen.ts` | board shapes (cross, donut, stairs, L-tray, spiral, maze, twin trays, islands), pits, narrow bridges, bridges, edge rails, all jelly shapes (plus, U, hook, fat T, comb, C-ring + plug, any pentomino, giants), stone / gold / rainbow / mixed-colour / heavy / ghost / bubble / rail / arrow jellies, crates and drag walls, floor drains, packing boxes and picture boxes, narrowing / corner / spare-part gates, flip pads, paint pots, 5–6 colours, shades, one-colour stages |
| insert (≈110) | added to a solved stage on cells / moments the proven route really uses, then the route is replayed | switches + laser fences, red/blue blocks, plates, hidden switches, drawbridges, keys + locked gates, chains, cages, ice blocks / sleepers, key jellies, crate stacks, glass blocks, dominoes, number locks, tape, balloons, grumpies, fuse walls, bombs, blink walls, zap fences, crushers, clock arms, shrinking / growing trays, popcorn, vines, targets, coins + coin gates, tolls, stars, numbered / queue / cycling / blinking / arrow / deep / weight / area / fake / rainbow gates, Kranky's swaps, paint bombs, freezes, gate shuffles, ice, mud, bumpers, springs, traps, rewinds, bouncers, rinse, splash + wash, chargers, bubbles + thorns, teleports, crumble, glass, counters, snares, glue, no-squish zones, filters, chameleons, stripes, lazy and bouncy jellies |
| post (≈30) | fitted to the final route | move limit, exact par, clock, no undo, undo costs, exit / colour order, code locks, kings, keepers, some-out, one turn, one drag each, no touch, clash, combo, time loop, countdown / fragile / bomb-run jellies, setting jellies, slow set, one-squish |
| resolve (≈70) | things that move on their own — the stage is proven again by the solver (or keeps its route when the idea never touches it) | gravity (down / up / arrows), drift, slippery and zero-G, wrap and torus, echo moves, crowds, leaders, twins, copycats, echo trays, Kranky's jelly and chasers, shy jellies, magnets (pull / push), magnet tiles, wind lanes / currents / fans / vacuums / pistons, tilt buttons, swap pads, shrink / stretch / split / press / copy pads, spinners, babies, hungry jellies, spin squish, build first / big finish, survive, spawners and gumball machines, sliding / hopping / wheel gates |
| view (≈22) | looks and input twists that never change what is legal | fog, lamps, smoke, dark rooms, peek, remember the gates, night glow, neon, black & white, tones, mystery grey, gold rush, part counters, the tray turning (twist, upside down, spin), delay, contrary and mirror input |
| meta (≈40) | taught by a card | helpers, core rules, colour symbols, world cards |

A few ideas are close cousins rather than exact copies of the plan's wording, so they could be built and proven the
same way as the rest: pits block jellies (bubbles and ghosts float over them) instead of making them fall; the Turntable,
Gear and Quarter Spin are many-use turn pads; Pipes / Crane / Lift Platform / Edge Portals / Portal Gate are teleports;
Laser Cutter / Cutter Line / Splitter / Unsquish / Two-Tone / Stuck Pair / Unmixer use the split pad; Melt / Swell are
shrink / stretch pads; Mixer / Stamp Press use colour mixing / the press pad; the Revolving Door and Gate Lever are switch
doors; Echo Gate / Gumball / Spawner drop a gold jelly that leaves by any gate it fits; Settle / Goo / Gum / Honey are
snares; Quake is a slow blink wall.

**Proof (headless sweeps, every stored route replayed with the real rules):**
- all 380 journey meet / boss stages (one per idea): every one builds with its idea and clears; average ~1.2 s per build,
  the 69 self-moving ideas 0.5–9 s (built in the worker while you play the stage before);
- a sample of 172 journey stages across 1–1,200: 0 unsolvable, 0 spare boards, average 1.2 s (95 % under 3.8 s);
- a sample of 67 Fusion Jam stages (1,201–1,400): 0 unsolvable, 1 spare board in 67, average 2.4 s.
When a stage with several ideas won't build, the builder makes a simpler version that keeps its first idea (about 2–4 %
of mixed stages lose a secondary idea this way); the spare board is the last resort.

**Phase 4 — modes and extras** (title screen grid):
- **Daily Jam** (one stage a day from your learned ideas, coins + streak), **Kranky Weekly** (a boss mix each week),
  **Rush** (3 minutes, as many quick stages as you can, best score), **Zen** (no limits, no clocks, calm music),
  **Puzzle Packs** (20 stages per idea family — boards, shapes, squish, gates, tiles, machines, obstacles, jellies,
  colours, rules, space, Kranky), **Jam Lab** (pick up to three ideas you've found + Easy / Normal / Hard → a fresh stage).
- **Concept Dex** — all 400 ideas by family, found ones named, the rest "?", with the world that teaches each.
- **Jelly Shop** — jelly finishes (gloss, pastel, glitter, glass, chrome, neon), trays (wood, marble, candy, galaxy) and
  confetti, bought with the coin jar.
- **Helpers** — 13 helpers (Bolt Magnet, Bonbon Squish, Hoot Rewind, Hammer, Momo Push, Gloop Sponge, Zib Beam, Paint Brush,
  Extra Turn, Extra Moves, Tiki Peek, Pip Freeze, Turbo Reroll), unlocked by meeting them on the journey, paid with charges
  earned from stars (1 per 12) and bosses (+2).
- **Lost states** — move limits, clocks, countdowns, setting jellies, combos, keepers and falls can lose a stage: an
  "oh no" sheet offers Undo or Try again; rule chips under the HUD show moves left, the clock, the exit order, keys,
  coins, bonus stars and lives.

### Phase 5 — status (polish & QA, built 2026-11-18)

**ASMR sound set** (`src/jelly/sfx.ts`, synthesised live, no files): a wet squelch when you grab a jelly (lower for big
ones), soft ticks while you drag, a plop where it lands, a juicy bloop when blocks squish — tuned to the stage's key,
bigger blocks lower — and a cork pop out of every gate with a chime that climbs the scale as the tray empties. Every tile
and machine has its own voice (ice shimmer, mud squelch, belt hum, teleport shimmer, spring boing, bumper thump, laser
doors, crumble, glass, magnets, wind, split, shrink / grow, Kranky's grumble…), plus a sparkling run on a win and a
wah-wah on a loss. All of it runs through the SFX bus (volume sliders apply) and is panned by where it happens.

**World music and ambience:** every world keeps its own bands, mood and tempo, and now each 10-stage chapter has its own
melody (the world's theme), while style, key, tempo and section order still change every stage. A quiet ambience
bed plays under each world — simmering pots in the kitchen, birds in the greenhouse, bubbles in the bath and the reef,
waves and creaks on the pirate ship, tick-tock in the clock shop, a far music box in the toy rooms, hum and blips in space,
the robot lab and the neon arcade, wind and chimes in the snow and the desert, rumble in the volcano. The music adapts:
a sparkle layer joins once the tray is nearly clear, and the beat speeds up in the last 10 seconds of a clock.

**Difficulty that keeps climbing:** the curve no longer flattens after stage 300 —
`difficultyAt(n) = 0.05 + 1.1·(1 − e^(−n/180)) + 0.45·clamp((n − 300)/900) + 0.12·clamp((n − 1200)/600)`
(300 → 0.94, 600 → 1.26, 900 → 1.43, 1,200 → 1.6, Fusion Jam up to 1.72). Board size, colours, parts per block and
tangles now keep scaling past 1.0 (late worlds may use the 9 × 12 tray). Bosses stay big even with self-moving ideas.
Stages that introduce a tile or machine use a smaller tray, and a 3–4-idea Fusion mix is a little lighter.

**Teaching stages really use their idea:** a stage that introduces a hazard or machine (and a boss's own idea) used
to put it on cells the proven route never touches. Now the idea is placed where the route lands, the old route is
replayed up to the move where the idea first changes play, and the solver finishes from there — so the solution meets
the idea. 23 of the 52 spot-placed ideas now show up on their first stage this way (Ice, Bumper, Shrink Pad, Wind Lane,
Fan, Pipes, Portal Gate, Magnet Tile, Swap Pair, Rewind Trap…); the rest keep the old placement when the solver can't
finish in time (the tile is still on the board, just not required). Gate, lock and rule ideas were already fitted to
what the route really does.

**Builds:** the "simpler take" retries share one time limit (≈ 9.5 s worst case), and a plain stage is tried before the
spare board, which is now seeded (colours, gate spots, mirror) so it never repeats.

**Phone performance:** the biggest late boards (9 × 12, 14 jellies) draw ≈ 100 calls and ≈ 75 k triangles at ≈ 2.8 ms
CPU per frame on a desktop. Loading stage after stage keeps geometry and texture counts flat (no leaks).

**Store art:** three new screenshots from real 3D captures — the Space Pantry (gravity), the Neon Arcade and Kranky's
Fortress finale (`shot-space`, `shot-neon`, `shot-fortress`).

**QA sweep (1,200 journey + 500 Fusion Jam stages, every stored route replayed with the real rules):**
- **100 % solvable:** 0 unsolvable, 0 spare boards, 0 build errors in all 1,700.
- **No repeats:** no two stages share a board, or even the same jellies and gates in other places; all 500 Fusion stages
  are different mixes with different names, and no set of ideas comes back.
- **Difficulty curve** (average per 100 stages): moves 5.8 (1–100) → 10 (101–200) → 12 (400s) → 13–15 (800–1,200) → 14–16
  in the Fusion Jam; jellies 5.5 → 9 → 10 → 11–12; colours 2.6 → 4.2. Breathers stay lighter (10 moves), burners and
  bosses heavier (13.5–13.7). Two bosses are still on the light side (World 8: 8 moves, World 18: 5 jellies).
- **Ideas kept:** 2.4 % of journey stages and 7.2 % of Fusion stages fall back to a simpler version that drops a secondary
  idea (the stage's first idea always stays).
- **Build time** (in the worker, while the stage before is played): journey median 1.0 s, 95 % under 3.6 s, slowest
  10.7 s; Fusion median 1.5 s, 95 % under 5.3 s, slowest 10.9 s. The solver now has a time limit as well as a size limit,
  so self-moving ideas can no longer stall a build.

## 14. Decisions for you before building

1. Name **Momo Jelly Jam** — OK, or another name?
2. **3D wobbly jelly with little faces** — OK?
3. **60 levels per world (1,200 journey levels)** — OK, or fewer / more per world?
4. Start with **Phase 1** as described?
