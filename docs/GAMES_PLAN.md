# MOMOBLOBS — 30 Games Plan

Every game: **funny clay characters · unlimited procedurally generated levels · score + combo + best score · coins · works on phone, tablet and PC.**
Focus and memory are the heart of the arcade (14 of 30 games), with brain, speed, numbers and puzzle games around them so every kind of player has a favourite.

## The cast (11 clay characters)

| id | Character | Personality (the joke) | Hosts |
|---|---|---|---|
| `momo` | **Momo** — orange clay blob with a sprout | Loves hiding, always gets found | Momo Shuffle, Maze Munch, Count Fast |
| `kranky` | **Kranky** — crab in a top hat | Sneaky cheat, laughs when you miss | Pick the Door, What's Missing |
| `tiki` | **Tiki** — teal bird with a level sign | Cheerleader, holds every sign | Memory Bridge |
| `pip` | **Pip** — penguin in a red scarf | Forgets *everything*, even his own name | Fish Watch, Pip's Pantry |
| `gloop` | **Gloop** — lime slime with one big tooth | Wobbly, splits into copies, very sticky | Spot the Sneak, Whack-a-Gloop, Gloop Guard, Gloop Pipes |
| `hoot` | **Prof. Hoot** — owl with giant glasses & cap | Knows everything, falls asleep mid-sentence | Color Clash, Pattern Parade, Quick Draw, Balance Buddies |
| `bonbon` | **Bonbon** — pink hippo chef | Eats the ingredients when you're not looking | Order Up!, Bake Drop, Sum Slices |
| `zib` | **Zib** — purple one-eyed alien | Hides in crowds, terrible at parking UFOs | Where's Zib?, Slide Ship, Odd Blob Out |
| `turbo` | **Turbo** — snail with a rocket shell | Slowest animal, fastest racer | Turbo Dash, More or Less |
| `bolt` | **Bolt** — boxy robot with a screen face | Speaks in beeps, dances when happy | Bolt's Beep Boop, Glow Grid, Who Said It? |
| `noodle` | **Noodle** — very long sausage dog | Too long to fit on screen, stretches | Blink!, Number Ninja, Shadow Snap, Firefly Switch |

Sprite poses for every character: `happy`, `wow`, `sad` (plus Momo's `sly`, `wave`).

## Shared rules (all 30 games)

- **Levels never end.** Every level is generated from a seed; difficulty keeps rising gently (no sudden jumps), then keeps adding variety (new twists) once speed/size hits its cap.
- **Two play styles**
  - `rounds` — puzzle/memory/focus games. A miss never ends the game: you retry the same level with a fresh layout. Score keeps adding up.
  - `run` — speed/arcade games. 3 hearts per run, difficulty rises with time/score, run ends at 0 hearts → results → play again instantly.
- **Score** = base points × combo (×1 → ×5 for streaks) + speed bonus. Best score, max level and play time are saved per game in the browser.
- **Coins** for every level cleared / run finished → spend in the cup shop.
- **Funny feedback**: characters change pose (happy / wow / sad), squash-and-stretch, confetti, the original clay SFX (boing, pop, squish, snicker, tada, sad trombone).

## Focus (7)

| # | Game | Cast | How it plays | Levels (unlimited) | Score |
|---|---|---|---|---|---|
| 1 | **Fish Watch** `fish-watch` | Pip | Golden fish glow, then turn grey and swim around the pond. Tap the fish that were golden (multiple-object tracking). | Targets 1→6, fish 4→18, swim time 3→9 s, speed up, later fish swap colours mid-swim. | 100/target, perfect-round bonus. |
| 2 | **Spot the Sneak** `spot-the-sneak` | Gloop | A crowd of Gloops; one is different (eye, tooth, colour, tilt). Find it before the timer melts. | Crowd 6→64, differences get subtler, crowd starts wobbling. | Faster find = more points; wrong tap melts time. |
| 3 | **Color Clash** `color-clash` | Prof. Hoot | Stroop: the word "RED" written in blue. Rule sign says *tap the INK* or *tap the WORD*. | 10 prompts/level; time per prompt shrinks, rule flips more often, more colours. | Correct × combo, speed bonus. |
| 4 | **Blink!** `blink-change` | Noodle | Look at Noodle's room, Noodle blinks, one thing changes (colour, missing, moved). Tap what changed. | Objects 4→24, smaller changes, shorter look time, 2 changes at once later. | Points + look-time bonus. |
| 5 | **Where's Zib?** `where-is-zib` | Zib | Busy scene full of aliens and junk. Zib (one eye, antenna) is hiding — find him. | Crowd density 10→120, look-alike aliens, moving crowds. | Time-based. |
| 6 | **Shadow Snap** `shadow-match` | Noodle | A clay shadow appears; tap the character that casts it. | Options 3→9, shadows rotate & flip, timer shrinks. | Correct × combo. |
| 7 | **Gloop Guard** `gloop-guard` | Gloop | Go / no-go: tap the green Gloops at the door, *never* the red ones (and don't tap Momo!). | Spawn rate up, more look-alikes, colour-swapping Gloops. `run`, 3 hearts. | +10 per correct, combo. |

## Memory (7)

| # | Game | Cast | How it plays | Levels | Score |
|---|---|---|---|---|---|
| 8 | **Memory Bridge** `memory-bridge` | Tiki | Stones light up in a path order; hop Tiki across in the same order or SPLASH. | Path length 3→∞, grid 3×3→5×6, flash speed up. | 50/stone × combo. |
| 9 | **Pip's Pantry** `pips-pantry` | Pip | Flip fridge doors to find food pairs (Pip forgot where he put them). | Pairs 3→18, Kranky swaps two closed doors on later levels. | Match points, fewer moves = bonus. |
| 10 | **Bolt's Beep Boop** `bolt-beeps` | Bolt | Simon: Bolt's chest buttons beep a sequence; repeat it. | +1 beep per level, 4→6 buttons, *Backwards!* every 5th level. | 20/beep × level. |
| 11 | **Order Up!** `order-up` | Bonbon | A customer flashes a cake order; build it from memory, bottom to top. | Layers 2→8, toppings, two orders at once later. | Per correct layer + perfect bonus. |
| 12 | **Glow Grid** `grid-glow` | Bolt | Cells glow for a moment; tap every glowing cell. Later: tap in the same order. | Grid 3×3→7×7, cells 3→18, shorter flash. | Per cell, perfect bonus. |
| 13 | **Who Said It?** `who-said-it` | Everyone | Characters pop up and make silly noises in order; tap them in the same order. | Sequence grows, more characters on stage, shuffled seats. | Per correct + combo. |
| 14 | **What's Missing?** `whats-missing` | Kranky | Look at the shelf, the curtain closes, Kranky steals something. What's missing? | Items 4→20, view time shorter, steals 1→3 items. | Correct × combo. |

## Brain / logic (4)

| # | Game | Cast | How it plays | Levels | Score |
|---|---|---|---|---|---|
| 15 | **Pick the Door** `pick-the-door` | Kranky | Kranky hides a prize behind one door and gives clues ("not red", "left of the star"). | Doors 3→8, more clue types, trickier combinations. | Points, fewer peeks = bonus. |
| 16 | **Pattern Parade** `pattern-parade` | Prof. Hoot | A parade of shapes follows a rule — pick what comes next. | Rules: repeat → grow → rotate → colour cycle → mixed rules. | Correct × combo + speed. |
| 17 | **Odd Blob Out** `odd-blob-out` | Zib | Which blob breaks the rule? (colour, shape, eyes, hat — later combined) | 4→12 blobs, two-attribute rules. | Correct × combo. |
| 18 | **Balance Buddies** `balance-buddies` | Prof. Hoot | See-saws show who is heavier. Who is the heaviest of all? | 3→7 buddies, hidden comparisons, "lightest" questions. | Correct × combo. |

## Speed / reflex (4)

| # | Game | Cast | How it plays | Levels | Score |
|---|---|---|---|---|---|
| 19 | **Whack-a-Gloop** `whack-a-gloop` | Gloop, Momo | Gloops pop out of holes — bonk them, but never bonk Momo. Golden Gloop = bonus. | `run`. Holes 6→12, faster pops, decoys. | 10/bonk × combo. |
| 20 | **Turbo Dash** `turbo-dash` | Turbo | 3-lane endless race: swipe/arrows to dodge cones and puddles, grab leaves. | `run`. Speed ramps forever, new obstacles. | Distance + pickups. |
| 21 | **Bake Drop** `bake-drop` | Bonbon | Catch falling cake bits in the bowl, dodge the chilli peppers. | `run`. Faster drops, wind, bigger combos. | Per catch × combo. |
| 22 | **Quick Draw** `quick-hoot` | Prof. Hoot | Wait… wait… tap the instant Hoot shouts NOW! Fake-outs ("NOW-ish", wrong colour) catch you out. | Reaction window shrinks, more fake cues. | Faster reaction = more points. |

## Numbers (4)

| # | Game | Cast | How it plays | Levels | Score |
|---|---|---|---|---|---|
| 23 | **Count Fast** `count-fast` | Momo | Momos bounce across the stage, then hide. How many were there? | Count 2→25, shorter show time, Gloop decoys that don't count. | Correct × combo + speed. |
| 24 | **Sum Slices** `sum-slices` | Bonbon | Tap cake slices whose numbers add up to Bonbon's target. | Targets 5→99, more slices, subtraction slices later. | Per target, speed bonus. |
| 25 | **Number Ninja** `number-ninja` | Noodle | Tap 1, 2, 3… in order, as fast as you can (Schulte table — mega focus). | Grid 3×3→7×7, numbers wiggle, reverse order & A–Z later. | Time-based. |
| 26 | **More or Less** `more-or-less` | Turbo | Two jelly jars — tap the one with more beans, quick! | Ratios get closer (2:1 → 10:9), time shrinks, "less" rounds. | Correct × combo + speed. |

## Puzzle (4)

| # | Game | Cast | How it plays | Levels | Score |
|---|---|---|---|---|---|
| 27 | **Slide Ship** `slide-ship` | Zib | Slide the tiles to rebuild Zib's spaceship. | 3×3 → 4×4 → 5×5, deeper scrambles. | Fewer moves + time = more points. |
| 28 | **Gloop Pipes** `gloop-pipes` | Gloop | Rotate pipes so slime reaches every cup. | Grid 3×3 → 8×8, leaks, locked pipes. | Per solve, par-move bonus. |
| 29 | **Firefly Switch** `firefly-switch` | Noodle | Each jar toggles itself and its neighbours — light every firefly. | Grid 3×3 → 7×7, more scrambled starts. | Per solve, par bonus. |
| 30 | **Maze Munch** `maze-munch` | Momo, Kranky | Guide Momo through a clay maze, munch cookies, reach the exit. | Mazes grow, fog of war, Kranky patrols. | Cookies + time. |

## YouTube Shorts version (comment-your-answer)

Every game gets a **Video Mode** that renders a 9:16 Short from the same game code: hook → challenge → freeze with labelled options (1/2/3 or A/B/C) → 5–10 s think timer → end card with a **level code** (e.g. `FISH-4821`) that opens the same challenge on momoblobs.com. No on-screen reveal; the answer is pinned after 24 h. Answer key, pinned comment and title/description/hashtags are generated per video.

- 25 games ask their own question directly (e.g. Count Fast "How many Momos?" → `12`; Pick the Door "Which door?" → `4`; Gloop Pipes "Which cup does the slime reach?" → `2`; Quick Draw "Pause on NOW and comment your time").
- 5 fast reflex games use a video-only question: Gloop Guard (how many green Gloops got in?), Glow Grid (which squares glowed?), Whack-a-Gloop (how many golden Gloops?), Turbo Dash (which lane is safe?), Bake Drop (how many chillies fell?).
- Answers are always short tokens: a number, a letter, a colour or a character name.
- Reading YouTube comments automatically (e.g. a "correct answers" leaderboard) needs the YouTube Data API and a server — a later add-on. The site can't post YouTube comments; it offers "Share my score" links instead.

Full per-game table: `GAMES_PLAN_TELUGU.md`.

## Build notes

- Engine: `src/arcade/engine.ts` (2D canvas, clay drawing helpers, sprites, particles, timers, score/combo/hearts, sounds) + `src/arcade/ArcadeHost.tsx` (lobby, HUD, banners, results, saving) running inside the shared `GamePlayer`.
- Each game is one file `src/arcade/games/<slug>.ts` exporting a class that extends `ArcadeGame`.
- Catalogue, SEO text and how-to content: `src/lib/games.ts`.
