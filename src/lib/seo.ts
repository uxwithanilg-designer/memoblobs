// Search text for every game page: the <title> (the layout adds " | MOMOBLOBS"), the meta / social description
// and the search phrases people actually type. Kept apart from the game catalogue so the long in-page copy in
// games.ts stays free to read naturally.
//
// Rules when adding a game:
// - title: "<Game name> — <what it is>", about 40–55 characters before the " | MOMOBLOBS" suffix
// - description: one or two full sentences, 120–155 characters, says what you do + "free" + "in your browser"
// - keywords: 5–8 phrases a player would search for, most important first
// - updated: the day the game's page or game last changed in a way worth re-crawling (sitemap lastmod)

import type { Game } from "./games";

export interface GameSeo { title: string; description: string; keywords: string[]; updated?: string }

/** the day this SEO pass went live — every page's text changed then */
const SEO_PASS = "2026-11-22";

export const GAME_SEO: Record<string, GameSeo> = {
  // ------------------------------------------------------------ 3D games
  "momo-shuffle": {
    title: "Momo Shuffle — Free 3D Cup Shuffle Game",
    description: "Follow Momo under the cups while Kranky shuffles faster and faster. A free 3D shell game with 3, 4 or 6 cups — play online in your browser.",
    keywords: ["cup game", "shell game", "find the ball under the cup", "cup shuffle game", "3d cup game online", "focus game"],
  },
  "sky-roll": {
    title: "Momo Sky Roll — 3D Rolling Ball Music Game",
    description: "Roll Momo along floating sky paths to the beat. Steer, jump and boost through 20 music worlds in this free 3D rolling ball game online.",
    keywords: ["rolling ball game", "3d ball game", "music runner game", "rhythm game online", "sky ball game", "endless ball game"],
  },
  "momo-escape": {
    title: "Momo Escape — 3D Swipe Maze Escape Game",
    description: "Swipe Momo wall to wall to escape Kranky's trap-filled buildings, floor after floor. A free 3D swipe puzzle runner you can play in your browser.",
    keywords: ["escape game", "swipe maze game", "tomb runner game", "wall dash game", "maze escape online", "one touch game"],
  },
  "rollo-rush": {
    title: "Rollo Rush — 3D Speed Running Adventure",
    description: "Sprint after Mayamma the Sky Witch through 25 worlds to save Rollo's brother. A free 3D running game with a voiced story, bosses and power-ups.",
    keywords: ["running game", "3d runner with story", "speed run game", "endless runner online", "boss runner game", "phone running game"],
  },
  "momo-jelly-jam": {
    title: "Momo Jelly Jam — 3D Jelly Block Puzzle",
    description: "Drag wobbly jelly pieces, squish matching colours into blocks and pop them out of the right gate. A free 3D block puzzle with endless stages.",
    keywords: ["jelly puzzle", "block puzzle game", "color match puzzle", "3d puzzle game online", "jam puzzle", "sliding block puzzle"],
  },
  "nitro-rush": {
    title: "Nitro Rush — 3D Car Racing Game Online",
    description: "Race the MOMOBLOBS gang across 29 giant 3D worlds, from neon cities to the Moon. Drift, hit the nitro and win cups in this free racing game.",
    keywords: ["car racing game", "3d racing game online", "nitro racing", "browser car game", "kart racing game", "free racing game"],
  },
  "drift-kings": {
    title: "Drift Kings — 3D Drifting & Rally Game",
    description: "Hold DRIFT, slide through the bends and chain drifts up to ×5. A free 3D drift and rally racing game you can play right in your browser.",
    keywords: ["drift game", "drifting game online", "rally racing game", "3d drift car game", "drift racing", "car drifting browser game"],
  },
  "highway-heat": {
    title: "Highway Heat — Traffic Racer & Police Chase",
    description: "Weave through highway traffic at full speed, chain near misses and outrun the police — or play the cop. A free 3D traffic racing game online.",
    keywords: ["traffic racer", "highway racing game", "police chase game", "cop car game", "traffic driving game", "3d highway game"],
  },
  "moto-rush": {
    title: "Moto Rush GP — 3D Motorbike Racing Game",
    description: "Lean into corners, pop wheelies, slipstream rivals and win the Grand Prix. A free 3D motorbike racing game you can play in your browser.",
    keywords: ["motorbike racing game", "bike racing game online", "motorbike grand prix", "3d bike game", "motorcycle game", "wheelie game"],
  },
  "blob-brigade": {
    title: "Blob Brigade — 3D Crowd Runner Battle",
    description: "Grow one blob into a giant brigade: pick the best math gates, march through 100+ stages and beat the boss. A free 3D crowd runner game.",
    keywords: ["crowd runner game", "math gate game", "crowd count game", "army runner", "3d crowd game", "crowd battle game"],
  },
  "momo-boing": {
    title: "Momo Boing! — 3D Bouncing Jump Game",
    description: "Bounce Momo up clay platforms through the sky — every bounce plays the song. Land perfect boings in this free 3D jumping game online.",
    keywords: ["bouncing game", "jump game online", "endless jump game", "3d platform jumper", "sky jump game", "music bounce game"],
  },
  "momo-dash": {
    title: "Momo Dash! — 3D Endless Runner Game",
    description: "Swipe, jump and slide down three lanes through 12 worlds while the Grumpy Guard chases. A free 3D endless runner made for phones and PC.",
    keywords: ["endless runner", "3 lane runner", "3d running game", "swipe runner", "lane runner game", "free runner game online"],
  },
  "kiko-jungle-quest": {
    title: "Kiko's Jungle Quest — 3D Jungle Runner",
    description: "Run, swing on vines and ride animal friends through 15 jungle regions to win back the Golden Seeds. A free 3D monkey runner game online.",
    keywords: ["jungle runner", "monkey game", "jungle running game", "3d jungle game", "vine swing game", "animal runner game"],
  },
  "puddo-clayland": {
    title: "Puddo's Clayland — 3D Run & Gun Platformer",
    description: "Blast the Dust Army, throw Storm Bombs and bring back the rain across 400 clay stages. A free 3D run-and-gun platform game in your browser.",
    keywords: ["platformer game", "run and gun game", "side scroller online", "retro platformer", "3d platform game", "shooting platformer"],
  },
  "slurp-lab": {
    title: "Slurp Lab — 3D Color Logic Puzzle",
    description: "Drag glowing Slurpers over jelly Gloopies — each drinks only its colour and exactly its number. A free 3D brain puzzle with 600+ stages.",
    keywords: ["logic puzzle", "color puzzle game", "brain puzzle online", "3d puzzle game", "number puzzle", "sort puzzle game"],
  },
  "tondu-vine-climb": {
    title: "Tondu's Vine Climb — 3D Lizard Climbing Game",
    description: "Tap to flip Tondu the lizard round the vine, dodge thorns, snap bugs and climb 600 stages. A free 3D climbing game you can play online.",
    keywords: ["climbing game", "vine climb game", "lizard game", "tap to switch game", "3d climber online", "one tap game"],
  },

  // ------------------------------------------------------------ focus
  "fish-watch": {
    title: "Fish Watch — Track the Golden Fish Game",
    description: "Keep your eyes on the golden fish as they turn grey and swim around the pond, then tap them. A free object-tracking focus game online.",
    keywords: ["tracking game", "follow the fish game", "multiple object tracking", "focus game", "attention game online", "eye tracking game"],
  },
  "spot-the-sneak": {
    title: "Spot the Sneak — Find the Odd One Game",
    description: "One Gloop in the crowd is a sneaky copy: a missing tooth, a wrong eye, a tiny hat. Find it before the timer ends in this free focus game.",
    keywords: ["spot the difference", "find the odd one out", "find the different one", "observation game", "focus game online", "visual search game"],
  },
  "blink-change": {
    title: "Blink! — Spot What Changed Memory Game",
    description: "Study Noodle's room, then he blinks and one thing changes. Tap what's different in this free spot-the-change observation game online.",
    keywords: ["spot the change", "what changed game", "change blindness game", "observation game", "spot the difference online", "visual memory game"],
  },
  "where-is-zib": {
    title: "Where's Zib? — Find the Hidden Alien",
    description: "Zib the one-eyed alien hides in a crowded space party full of look-alikes. Find him before time runs out in this free hidden-character game.",
    keywords: ["find the character", "find the hidden character", "hidden object game", "seek and find online", "find the alien", "visual search game"],
  },
  "shadow-match": {
    title: "Shadow Snap — Match the Shadow Game",
    description: "A black clay shadow appears on the screen — tap the friend who casts it before the timer runs out. A free shadow matching game online.",
    keywords: ["shadow match game", "match the shadow", "shape matching game", "silhouette game", "visual matching online", "focus game"],
  },

  // ------------------------------------------------------------ brain
  "color-clash": {
    title: "Color Clash — Stroop Color Word Brain Game",
    description: "The word says RED but it's painted blue. Tap the ink or the word as the rule flips in this free Stroop brain-training game online.",
    keywords: ["stroop test game", "color word game", "brain training game", "stroop effect online", "attention test", "color brain game"],
  },
  "pick-the-door": {
    title: "Pick the Door — Logic Clue Puzzle Game",
    description: "Read Kranky's clue cards — colours, symbols, numbers, positions — and pick the door Momo is hiding behind. A free logic deduction game.",
    keywords: ["logic puzzle", "deduction game", "clue puzzle", "riddle door game", "reasoning game online", "brain teaser"],
  },
  "pattern-parade": {
    title: "Pattern Parade — What Comes Next Game",
    description: "Clay critters march in a pattern — pick the float that comes next. A free pattern recognition and sequence logic game you can play online.",
    keywords: ["pattern game", "what comes next", "sequence puzzle", "pattern recognition game", "logic game online", "brain teaser"],
  },
  "odd-blob-out": {
    title: "Odd Blob Out — Odd One Out Brain Game",
    description: "Every blob follows a rule — same colour, same hat, same eyes — except one. Tap the odd one out before the timer ends. A free brain game.",
    keywords: ["odd one out", "which one is different", "classification game", "brain teaser online", "logic game", "find the rule game"],
  },
  "balance-buddies": {
    title: "Balance Buddies — See-Saw Logic Puzzle",
    description: "See-saws show who is heavier. Work out who's the heaviest of all, even when two buddies never met. A free weight logic puzzle online.",
    keywords: ["balance puzzle", "weight logic puzzle", "see saw game", "which is heaviest", "reasoning game online", "logic brain teaser"],
  },

  // ------------------------------------------------------------ memory
  "memory-bridge": {
    title: "Memory Bridge — Sequence Memory Game",
    description: "Stones light up one by one with musical notes — remember the order and hop Tiki across the river. A free sequence memory game online.",
    keywords: ["sequence memory game", "simon says game", "memory sequence online", "remember the order", "memory training", "pattern memory"],
  },
  "pips-pantry": {
    title: "Pip's Pantry — Memory Pairs Card Game",
    description: "Open two fridge doors at a time and find every matching snack pair for Pip the penguin. A free memory match pairs game you can play online.",
    keywords: ["memory match game", "pairs game", "concentration card game", "matching game online", "memory card game", "flip cards game"],
  },
  "bolt-beeps": {
    title: "Bolt's Beep Boop — Beep Sequence Memory Game",
    description: "Watch Bolt's buttons light up and beep a tune, then tap it back. Every level adds a note. A free sound and colour memory game.",
    keywords: ["simon says game", "memory sequence game online", "color sequence game", "sound memory game", "repeat the pattern", "memory game"],
  },
  "order-up": {
    title: "Order Up! — Cake Memory Game",
    description: "See the cake a customer wants, then build it from memory layer by layer. A free cooking memory game in Bonbon's cake shop, online.",
    keywords: ["cake game", "cooking memory game", "remember the order", "bakery game online", "memory game", "cake builder game"],
  },
  "grid-glow": {
    title: "Glow Grid — Visual Pattern Memory Game",
    description: "Squares glow for a moment then go dark — tap every one that lit up. Grids grow from 3×3 to 7×7 in this free visual memory game online.",
    keywords: ["pattern memory game", "visual memory test", "memory grid game", "remember the squares", "memory matrix", "brain training online"],
  },
  "who-said-it": {
    title: "Who Said It? — Listening Memory Game",
    description: "Characters pop up and make silly voices — tap them back in the same order. A free listening and sequence memory game you can play online.",
    keywords: ["listening game", "audio memory game", "sound sequence game", "remember the voices", "memory game online", "voice sequence game"],
  },
  "whats-missing": {
    title: "What's Missing? — Short-Term Memory Game",
    description: "Study the toy shelf, then Kranky steals something behind the curtain. Pick what's missing in this free short-term memory game online.",
    keywords: ["what's missing game", "memory game", "short term memory test", "missing object game", "observation memory game", "kim's game online"],
  },

  // ------------------------------------------------------------ reflex
  "gloop-guard": {
    title: "Gloop Guard — Go / No-Go Reaction Game",
    description: "Tap the green Gloops into the party, never the red crashers. A free go/no-go reaction and impulse-control game you can play online.",
    keywords: ["go no go game", "reaction game", "impulse control game", "tap the green", "reflex test online", "quick tap game"],
  },
  "whack-a-gloop": {
    title: "Whack-a-Gloop — Free Whack-a-Mole Game",
    description: "Bonk every Gloop that pops out of its hole, grab the golden ones and never bonk Momo. A free whack-a-mole reflex game in your browser.",
    keywords: ["whack a mole", "whack a mole online", "tap game", "reflex game", "bonk game", "arcade tap game"],
  },
  "turbo-dash": {
    title: "Turbo Dash — Snail Lane Racer Game",
    description: "Turbo the rocket snail zooms down three lanes — dodge cones, rocks and Kranky and munch lettuce. A free endless lane racing reflex game.",
    keywords: ["lane racer", "dodge game", "endless racing game", "3 lane game", "reflex racing online", "snail game"],
  },
  "bake-drop": {
    title: "Bake Drop — Catch the Falling Cake Game",
    description: "Slide the bowl to catch falling sponge, cherries and cream, and dodge Kranky's chilli peppers. A free catching game in Bonbon's bakery.",
    keywords: ["catching game", "catch falling objects", "bakery game", "cake catch game", "reflex game online", "bowl catch game"],
  },
  "quick-hoot": {
    title: "Quick Draw — Reaction Time Test Game",
    description: "Wait for the sign to flip to NOW!, then tap as fast as you can and see your time in milliseconds. A free reaction time test game online.",
    keywords: ["reaction time test", "reflex test", "how fast are you", "quick draw game", "reaction speed game", "click speed test"],
  },

  // ------------------------------------------------------------ numbers
  "count-fast": {
    title: "Count Fast — Quick Counting Game",
    description: "Momos bounce onto the stage, then the curtain drops — how many were there? A free quick counting and number sense game you can play online.",
    keywords: ["counting game", "quick count", "how many game", "number sense game", "subitizing game", "math game online"],
  },
  "sum-slices": {
    title: "Sum Slices — Mental Math Addition Game",
    description: "Tap cake slices whose numbers add up to exactly Bonbon's target. A free mental maths addition game that gets trickier every level.",
    keywords: ["addition game", "mental math game", "make the sum", "number puzzle", "math game online", "sum game"],
  },
  "number-ninja": {
    title: "Number Ninja — Schulte Table Speed Game",
    description: "Tap the shuffled numbers 1, 2, 3 and on in order as fast as you can and beat the par time. A free Schulte table focus and speed game.",
    keywords: ["schulte table", "find numbers in order", "number speed game", "focus training", "number grid game", "attention game online"],
  },
  "more-or-less": {
    title: "More or Less — Which Has More? Number Game",
    description: "Two jars of jelly beans pop up — tap the one with more before Turbo reaches the flag. A free number sense and estimation game online.",
    keywords: ["more or less game", "which has more", "estimation game", "number sense game", "compare quantities", "math game online"],
  },

  // ------------------------------------------------------------ puzzle
  "slide-ship": {
    title: "Slide Ship — Sliding Tile Puzzle Game",
    description: "Slide the jumbled tiles into the empty hole until Zib's crashed UFO is whole again. A free sliding tile puzzle (15-puzzle) game online.",
    keywords: ["sliding puzzle", "15 puzzle", "slide tile puzzle", "picture puzzle game", "sliding block puzzle online", "puzzle game"],
  },
  "gloop-pipes": {
    title: "Gloop Pipes — Pipe Connect Puzzle Game",
    description: "Turn the clay pipes so green slime flows from Gloop's tank into every cup. A free rotate-the-pipes connecting puzzle game in your browser.",
    keywords: ["pipe puzzle", "connect the pipes", "plumber puzzle game", "rotate pipes game", "flow puzzle online", "water pipe game"],
  },
  "firefly-switch": {
    title: "Firefly Switch — Lights Out Puzzle Game",
    description: "Each jar you tap flips its neighbours too. Light up every firefly jar in as few taps as you can. A free lights-out logic puzzle online.",
    keywords: ["lights out puzzle", "lights out game", "toggle puzzle", "logic puzzle online", "switch puzzle", "brain puzzle"],
  },
  "maze-munch": {
    title: "Maze Munch — Cookie Maze Game Online",
    description: "Guide Momo through a squishy clay maze, munch every cookie and reach the flag. A free maze game with a brand-new maze every level.",
    keywords: ["maze game", "maze game online", "labyrinth game", "find the way out", "cookie maze", "maze puzzle"],
  },
};

const CATEGORY_WORDS: Record<Game["category"], string> = {
  runner: "running game", adventure: "adventure game", racing: "racing game", puzzle: "puzzle game", brain: "brain game",
  memory: "memory game", focus: "focus game", reflex: "reaction game", numbers: "number game",
};

/** a sentence-safe cut: never ends mid-word, never longer than `max` */
function clip(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > max * 0.55) return cut.slice(0, stop + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—–-]+$/, "")}…`;
}

/** the search text for a game — the hand-written entry, or a safe fallback built from the catalogue for new games */
export function seoOf(g: Game): Required<GameSeo> {
  const s = GAME_SEO[g.slug];
  const kind = CATEGORY_WORDS[g.category];
  return {
    title: s?.title ?? `${g.title} — Free Online ${kind[0].toUpperCase()}${kind.slice(1)}`,
    description: s?.description ?? clip(g.description),
    keywords: s?.keywords ?? [g.title.toLowerCase(), kind, `free ${kind} online`],
    updated: s?.updated ?? (g.released && g.released > SEO_PASS ? g.released : SEO_PASS),
  };
}
