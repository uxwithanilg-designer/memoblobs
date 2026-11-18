# Momo Boing! — game plan

> Inspiration: an Ice Cream Jump reel (a Doodle-Jump-style endless jumper: auto-bounce, steer left/right, coins,
> a rainbow rocket power-up, flying bugs, crumbling platforms, fall = game over). We keep the *feel* of that loop
> (one thumb, instant, "one more go") and build our own game on top of it with the MOMOBLOBS cast, a 3D clay look
> and new mechanics. No ice cream, no cherry, no apple rocket, no flies — our own world.

**Pitch (one line):** Bounce Momo up through 10 sky worlds. Every bounce plays a note of the song, perfect taps
launch Comet Mode, and every friend you rescue stacks on Momo's head as a wobbly tower of extra lives — while the
Grumpy Goo rises from below.

## 1. Core loop (the first 10 seconds)

1. Momo bounces by itself on squishy clay platforms.
2. Steer left/right (drag anywhere, or tilt the phone). Walk off one side, come in on the other.
3. **Tap as Momo lands → PERFECT BOING!** A shrinking ring on the platform shows the moment. Perfect = higher jump,
   a sparkle and a bigger note.
4. Grab coins and music notes, pop friend bubbles, dodge Grumpies.
5. Keep climbing: the **Grumpy Goo** rises from below and gets faster. Fall into it (or off-screen) = run over.

## 2. The five big ideas (what makes it ours, and new)

### 2.1 Your bounces play the song
Every landing plays the **next note of the world's melody**; a Perfect Boing plays the accent with a drum hit; a
combo adds harmony layers (bass → chords → choir). The music the player hears is literally made by their bounces —
rhythm-game satisfaction without rhythm-game difficulty. Missed bounces never stop the song, they just play it
plainer. Each world has its own melody and instrument set (marimba garden, music-box candy, sleigh-bell snow…).

### 2.2 Perfect chain → COMET MODE
5 Perfect Boings in a row = **Comet Mode**: Momo turns into an orange comet for 3 s, rockets up, smashes through
Grumpies and vacuums coins. The chain counter (×2, ×3…) multiplies score. Skill is rewarded with the best moment in
the game — instead of a random rocket pickup, the player *earns* it.

### 2.3 Friend Stack (a wobbly tower of extra lives)
Friends (Pip, Gloop, Bolt, Bonbon, Zib, Turbo, Hoot, Noodle, Tiki, Kranky) float in bubbles. Touch one → the friend
hops onto **Momo's head**. Up to 5 stack into a jiggly totem.
- **Each friend is a save:** when Momo is hit or falls, the top friend jumps off and does a **rescue boing** under
  Momo (slow-mo hero moment), then waves goodbye.
- **Each friend lends a power while stacked:** Zib = coin magnet, Pip = freezes nearby Grumpies, Bolt = higher
  bounce, Turbo = faster steering, Gloop = sticky landings (edge saves), Bonbon = cake bomb clears the screen
  every 20 s, Hoot = slow-mo near danger, Tiki = springier perfects, Noodle = wider landing, Kranky = snips
  flying Grumpies.
- **Risk/reward:** score multiplier grows with the stack, but a taller tower is a bigger target.

### 2.4 The Grumpy Goo rises
A purple goo wave full of Grumpy faces climbs after you and speeds up with height. It makes every run an escape:
no camping, and constant gentle pressure. Between worlds there's a **Safe Cloud** where the goo stops for a breath.

### 2.5 Pick-a-Power (roguelite runs)
At every Safe Cloud, pick **1 of 3 power cards** for this run: Double Boing (one mid-air jump), Spring Shoes, Coin
Magnet, Wide Feet, Bubble Shield, Lucky Comet (comet after 4 perfects), Friend Finder (more bubbles), Slow Goo,
Cloud Maker (one emergency cloud when you fall). Every run builds differently.

## 3. Ten sky worlds (one every ~800 m, same worlds as Blob Brigade)

| # | World | Signature platform | Hazard / Grumpy | Music |
|---|---|---|---|---|
| 1 | Garden Sky | grass + leaf springs | Grumpy bees | marimba |
| 2 | Candy Clouds | **bubblegum**: sticky, hold & release to slingshot | sprinkle rain | music box |
| 3 | Snow Peaks | **ice**: Momo slides | snowball Grumpies, wind gusts | sleigh bells |
| 4 | Toy Tower | trampolines, wind-up moving blocks, **toy cannons** | bouncing toy Grumpies | toy piano |
| 5 | Beach Breeze | **beach balls** that roll | seagull Grumpies, water spouts | steel drums |
| 6 | Spooky Night | **ghost platforms** that only appear on the beat | bats, dark (lantern light) | spooky organ |
| 7 | Jungle Canopy | **vines** to swing, mushroom springs | monkey Grumpies throwing fruit | jungle drums |
| 8 | Lava Sky | crumbling rock, **geysers** as boosts | lava bubbles erupt upwards | brass |
| 9 | Space | **low gravity**, little planets to orbit | UFO beams | synth |
| 10 | Cloud Castle | drawbridges, cannons | **Mega Grump** boss at the top | epic |

After stage 100 the stages never end — see §4.

## 4. Stages: 100 hand-shaped + unlimited that never feel repeated

**Sky Map** (the main mode): stage 1, 2, 3 … on one long path of floating islands. Each stage is a short climb
(30–90 s) to a finish cloud, with 3 stars (reach the top / perfects / friends saved).

### 4.1 Stages 1–100: ten chapters of ten
One chapter per world (§3). Every chapter uses the same 10-stage rhythm so it teaches, tests, rests and peaks:

| # | Stage type | What it asks |
|---|---|---|
| 1 | Warm-up Climb | meet the world's new platform, gentle |
| 2 | Note Collector | grab N music notes on the way up |
| 3 | Friend Rescue | free 3 friend bubbles |
| 4 | Comet Run | breather: easy perfects, lots of comets and coins |
| 5 | Goo Chase | mini-boss: fast goo, no Safe Cloud |
| 6 | Platform Puzzle | only the world's signature platform (gum, ice, vines…) |
| 7 | Time Attack | reach the top before the clock |
| 8 | Long Climb | twice as tall, two Safe Clouds |
| 9 | Storm | hazards from every side |
| 10 | Boss Climb | the world's villain throws things from the top |

### 4.2 Stage 101 → ∞: built fresh, never a visible loop
No "Loop 2", no "Remix", no reset — the map just keeps going (Stage 101, 102 … 437 …). Every stage is generated
from its own number, so it is the same stage every time you replay it, but no two stages are the same. What gets
mixed, per stage:

- **Blended worlds:** after 100, each chapter blends two worlds, with a new name and look: *Frosty Candy*,
  *Moonlit Jungle*, *Lava Beach*, *Toy Galaxy* (10 worlds → 45 pairs), plus their platforms together (bubblegum on
  ice, vines in low gravity). A blend is not reused until most others have been seen.
- **Time of day & weather:** morning, sunset, night, aurora × clear, snowfall, candy rain, fireflies, meteor
  shower. Same world, very different picture.
- **Landmarks:** a rotating set of big background pieces per world, recoloured per palette.
- **Music:** each stage plays its world melody in a different key, tempo and instrument mix, and phrases are stitched
  from a pool of motifs, so the bounce-song changes too.
- **Stage-type order:** the 10 types are reshuffled each chapter (the boss stays last, a breather stays in the first
  half), and some get twists: mirror sky, windy, tiny platforms, double goo, low gravity, night with lantern light.
- **Names:** every stage gets a generated name (*Sprinkle Summit*, *Wobble Way*, *Comet Canyon*) so the map never
  shows "Garden 1" again.

### 4.3 Difficulty: tougher every stage, never a wall
Difficulty is a number `d(n)` that every knob reads: platform gap and width, share of moving / crumbling /
special platforms, goo speed, hazard rate, enemy count, friend-bubble and power-card frequency, and (gently) the
Perfect Boing window.

- **Staircase with breathers:** difficulty rises through each chapter, peaks at the boss; the next chapter starts a
  little lower than that peak but higher than the last chapter's start. Players feel the climb without burning
  out.
- **Never-ending but never impossible:** fast rise to stage 100, then a slow, steady rise (logarithmic) with
  some knobs reaching their limits and the new twists and blends doing the rest.
- **Quiet helper (kids):** after 3 losses on the same stage, the game quietly widens platforms and slows the goo a
  little for that stage only — never shown on screen.
- **Bot-tuned:** a par bot and a careless-kid bot play every stage in a sweep (like Blob Brigade) so no stage is a
  wall or a walkover.

## 5. Other modes

- **Endless Climb:** one tower, no finish — how high can you go? Best height, score and chain.
- **Daily Sky**: one seeded tower per day, same for everyone; streaks unlock hats (like the Blob Brigade daily).
- **Ghost race**: your best run's translucent ghost Momo bounces beside you — "beat your ghost!" (local only).

## 6. Meta

- Site coins (shared with every MOMOBLOBS game) buy **trails** (stars, bubbles, notes, rainbow), **bounce sounds**
  and **hats** — the Blob Brigade wardrobe hats work here too.
- 3 live **missions** at a time ("10 perfects in a row", "Rescue Pip 3 times", "Reach Snow Peaks without a fall").
- Character pick: play as Momo first, unlock others as the bouncer (each with a small twist).

## 7. Look & feel — "new look"

- **3D clay, not flat 2D:** three.js with a slightly tilted camera. Thick soft clay platforms with real shadows,
  parallax 3D clouds and big landmarks per world (cupcake mountains, ice castle, planets).
- **Juice:** squash & stretch on every landing, jelly wobble on the friend tower, note particles on perfects,
  screen-edge colour pulse on the beat, light haptics on Android for perfects.
- **App-like on mobile:** full-screen portrait, safe areas, one thumb, instant restart (under 1 s from fall to
  bouncing again), big readable HUD (height, chain, stack).

## 8. Controls

- **Touch (default):** drag anywhere to steer (relative, like Blob Brigade); a quick tap at landing = Perfect Boing.
- **Tilt (option):** tilt to steer, tap anywhere = Perfect Boing.
- Keyboard: ← → / A D to steer, Space = Perfect Boing.

## 9. How it differs from Ice Cream Jump

| Ice Cream Jump | Momo Boing! |
|---|---|
| flat 2D, one look | 3D clay, 10 worlds with their own platforms, hazards and music |
| random rocket pickup | **earned** Comet Mode from a Perfect Boing chain |
| one life | **Friend Stack**: friends are lives *and* powers |
| music in the background | **bounces play the song** |
| endless only | 100 stages + unlimited fresh stages + Endless + Daily Sky + ghost race + roguelite power cards |
| no pressure from below | rising **Grumpy Goo** makes every run an escape |

## 10. Build plan (same toolkit as Blob Brigade)

**Phase 1 is live** (`/play/momo-boing`, 2026-11-17): stages 1–30 (Garden Sky, Candy Clouds, Snow Peaks), all 10 stage
types, Perfect Boing (+ late-tap grace), Comet (5 in a row, 4 in Comet Run), Friend Stack (Pip slows Grumpies, Zib
magnet, Bolt higher bounce; a friend saves Momo from a fall or the goo), Grumpy bees and sitters (stomp from above,
side hits only bonk Momo down), falling drops with "!" warnings, boss villains at the top, rising Grumpy Goo, the
bounce song (`a:boing_<voice>` samples pitched per note), music beds per world, cover art.
- Code: `src/boing/` (`levels.ts` generator + `d(n)`, `sim.ts` + bot, `render.ts` depth layers, `models.ts`,
  `session.ts`, `save.ts`, `ui/BoingApp.tsx`). Balance: `node scripts/boing_sweep.mjs [runs] [skill]` (par ≈ 90%,
  careless kid ≈ 66% over stages 1–30). Audio: `python scripts/gen_boing_audio.py <momo/tools> <wav-dir> --mp3
  public/audio/arcade`. Art: `python scripts/build_boing_art.py [stage]` (dev server on :3000).

**Phase 2 is live** (2026-11-17): stages 31–100 (Toy Tower, Beach Breeze, Spooky Night, Jungle Canopy, Lava Sky,
Space, Cloud Castle), each with its own platforms and hazards (trampolines + cannons, rolling beach balls + water
spouts, ghost platforms, vines, lava vents + geysers + lava bubbles from below, low gravity + planets, drawbridges),
Grumpy look, villain, scenery, music bed and bounce voice. All 10 friends with powers (Gloop wider landings, Bonbon
cake bomb, Hoot slower goo, Turbo faster steering, Noodle easier timing, Tiki springier perfects, Kranky snips).
Safe Clouds offer 1 of 3 power cards (Double Boing, Spring Shoes, Coin Magnet, Wide Feet, Bubble Shield, Lucky
Comet, Slow Goo, Cloud Maker). Endless Climb (opens at stage 11) in the newest world, harder with height.
- **No stage select** (playtest request): stages come one by one; the next stage is saved locally (`current`), and
  leaving mid-climb restarts that stage from the bottom.
- The screen floor never scrolls past the platform Momo last stood on (big launches used to cause unfair falls), and
  bees never sit in launch gaps.
- Balance: `node scripts/boing_tune.mjs [from] [to] [runs]` fits `STAGE_EASE` per stage (par + kid bots together
  win ~83% early → ~62% at stage 100). Final sweep: par 78–95%, careless kid 50–84% per 20 stages; median stage ~40 s.

- `src/boing/`: pure-TS `sim.ts` (with a par bot for balance sweeps), `levels.ts` (seeded tower generator per
  world), three.js `render.ts`/`models.ts` (reuse the blob and Grumpy geometry), `session.ts`, `ui/BoingApp.tsx`,
  zustand save. Audio from a new `scripts/gen_boing_audio.py` (per-world note samples + loops).
- **Phase 1:** core bounce, Perfect Boing, Comet Mode, rising goo, Friend Stack (3 friends), bounces-play-the-song,
  the Sky Map with chapters 1–3 (stages 1–30) and the `d(n)` difficulty curve, title + results screens, mobile-first.
- **Phase 2:** worlds 4–10 with their platforms (stages 31–100), all 10 friends, Pick-a-Power cards, missions,
  Endless Climb, bosses.
- **Phase 3:** stage 101 → ∞ (world blends, weather, generated names and music), Daily Sky, ghost race,
  trails/hats/sounds shop, the quiet helper.

### Phase 3 notes (built)
- Stage 101+: chapters cycle through all 45 world pairs (shuffled per 45-chapter cycle, never the same main world
  twice in a row); the chapter also shuffles its stage types (warm-up first, a comet stage in slots 2–5, the boss
  last), rolls a time of day (day, morning, sunset, night, aurora), weather (snow, sprinkles, fireflies, leaves,
  embers, stars, bubbles) and sometimes a twist (windy, tiny, fast goo, low gravity, night climb). Place names come
  from 3 adjectives × 3 nouns per world, so a pair that comes back has a new name.
- Music for a blend: the bed alternates between the two worlds' loops, the bounce voice comes from the other world
  and the tune is re-arranged.
- Balance: `typeEase(type)` (the type's mean `STAGE_EASE` over chapters 7–10) × `LATE_TRIM[type]` (fitted with
  `node scripts/boing_tune_late.mjs <type>`), times a slow growth `1 + 0.5·(d − 1.08)` with `d` growing like a log.
  Sweep: stages 101–150 par 88% / kid 60% (like 81–100), 151–200 par 81% / kid 49%, 401–430 par 77% / kid 36%.
- Quiet helper: after 3 losses in a row on a stage, ease × 0.75 and one more friend bubble (nothing says so).
- Daily Sky (opens at stage 6): one seeded stage per date, difficulty follows your stage; streak + bonus coins.
- Ghost race: your best try at the stage you are on (fastest win, else highest climb) bounces along see-through.
- Wardrobe: 10 hats (Blob Brigade's hat models) and 6 trails, bought with site coins.
- The goo waits while the stage card is up, until the first touch (about 3 s).
