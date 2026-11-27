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
  "orbi-gp": {
    title: "Orbi GP — 3D Marble Racing Game in the Sky",
    description: "Race a glass marble at up to 350 km/h across 500 floating sky stages: balance, dodge and boost to win. A free 3D marble racing game in your browser.",
    keywords: ["marble racing game", "marble run game", "3d ball rolling game", "balance ball game", "sky racing game", "ball race online"],
    updated: "2026-11-23",
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

  "sudoku-ninefold": {
    title: "Sudoku Ninefold — Free Online Sudoku, 9 Boards",
    description: "Play free sudoku online: Classic 9×9, Killer, Samurai, X, Thermo, 16×16 and 25×25 boards, plus a Daily Sudoku and Weekly Epic for the whole world.",
    keywords: ["sudoku online free", "daily sudoku", "killer sudoku", "samurai sudoku", "16x16 sudoku", "sudoku x", "thermo sudoku", "sudoku puzzle game"],
  },

  trailfold: {
    title: "Trailfold — Free One-Line Path Puzzle Online",
    description: "Draw one line through every cell and hit the numbers in order. Nine kinds of path puzzle, endless and free online, plus a Daily Trail.",
    keywords: ["path puzzle", "one line puzzle", "connect the numbers", "draw a line puzzle", "hamiltonian path puzzle", "daily logic puzzle", "maze puzzle online"],
  },

  quiltfold: {
    title: "Quiltfold — Free Rectangle Logic Puzzle Online",
    description: "Cut the grid into rectangles, one number in each, its size. Nine kinds of rectangle puzzle, endless and free online, plus a Daily Quilt.",
    keywords: ["rectangle puzzle", "shikaku online", "divide the grid puzzle", "area logic puzzle", "daily logic puzzle", "grid puzzle game"],
  },

  glowfold: {
    title: "Glowfold — Free Binary Logic Puzzle Online",
    description: "Balance Ember and Frost orbs in every row and column, never three in a row. Nine kinds of binary puzzle, endless and free, plus a Daily Glow.",
    keywords: ["binary puzzle", "takuzu online", "binairo puzzle", "two symbol logic puzzle", "daily logic puzzle", "balance puzzle game"],
  },

  crownfold: {
    title: "Crownfold — Free Crown Placement Logic Puzzle Online",
    description: "Place one crown in every row, column and coloured court, and never let two crowns touch. Nine kinds of logic puzzle, endless and free, plus a Daily Court.",
    keywords: ["crown logic puzzle", "star battle puzzle", "region queens puzzle", "daily logic puzzle", "one per row puzzle", "free brain puzzle"],
  },

  blocktide: {
    title: "Blocktide — Free Endless Block Puzzle Game Online",
    description: "Drag jelly blocks onto an 8×8 reef and clear full rows and columns. One block puzzle that never ends: dive deeper as you score. Free in your browser.",
    keywords: ["block puzzle game", "free block puzzle online", "8x8 block puzzle", "endless block game", "line clear puzzle", "daily block puzzle"],
  },

  moonvial: {
    title: "Moonvial — Free Colour Sort Puzzle Game Online, Endless Stages",
    description: "Pour glowing potions until every vial holds one colour, then hand them to the star spirits. Endless water sort stages under the night sky, free in your browser.",
    keywords: ["water sort puzzle", "color sort game", "liquid sort puzzle online", "potion sort game", "free sorting puzzle", "endless puzzle stages"],
  },

  treatrio: {
    title: "Treatrio — Free 3D Goods Sort Puzzle Game Online, Endless Stages",
    description: "Sort 3D sweets on dessert-shop shelves: three alike pop, the next row slides forward. Endless triple match sorting stages, free in your browser.",
    keywords: ["goods sort game", "3d sorting puzzle", "triple match 3d", "shelf sort game", "match 3 sorting game", "free sort puzzle online"],
  },

  sproutpop: {
    title: "Sproutpop — Free 3D Bubble Shooter Game Online, 500+ Stages",
    description: "Aim, bounce and pop glossy 3D bubbles to free the seedlings. A free bubble shooter with 500 designed stages, eight gardens and endless remixes — play in your browser.",
    keywords: ["bubble shooter", "bubble shooter 3d", "free bubble shooter online", "bubble pop game", "bubble shooter no download", "match 3 bubble game", "bubble story game"],
  },

  "bubble-relics": {
    title: "Bubble Relics — Free 3D Bubble Shooter Game Online, 500+ Levels",
    description: "Aim the laser, pop glossy 3D bubbles and clear the temple walls. A free bubble shooter with 500 designed levels, eight temple chambers and endless remixes — play in your browser.",
    keywords: ["bubble shooter", "bubble shooter 3d", "bubble pop game", "free bubble shooter online", "bubble shooter levels", "classic bubble shooter", "temple bubble shooter"],
  },

  "bubble-breeze": {
    title: "Bubble Breeze — Free Bubble Shooter Game Online, 500+ Levels",
    description: "Aim, bounce and pop glossy bubbles in a breezy sky! A free classic bubble shooter with quests, 500 designed levels, eight worlds and endless remixes — light and smooth on any phone.",
    keywords: ["bubble shooter", "bubble shooter free", "classic bubble shooter", "bubble pop game", "bubble shooter online", "bubble blast game", "bubble shooter levels"],
  },

  "picnic-pairs": {
    title: "Picnic Pairs — Free Mahjong Connect Pairs Game Online, 500+ Levels",
    description: "Link matching food tiles with a path of up to two turns and clear the board before time runs out. A free mahjong connect / Onet pairs puzzle with 500+ levels — play in your browser.",
    keywords: ["mahjong connect", "connect pairs game", "onet game", "pair matching game", "tile matching puzzle", "mahjong pairs online", "food match game"],
  },

  "jade-slide": {
    title: "Jade Slide — Free Mahjong Slide Tile Match Puzzle Online, 500+ Levels",
    description: "Tap or slide mahjong tiles into line with their twins and clear the board. A free slide-mahjong tile match puzzle with 500+ levels and eight tea houses — play in your browser.",
    keywords: ["mahjong tile match", "mahjong slide", "slide mahjong puzzle", "mahjong pairs", "tile match puzzle", "free mahjong game online", "mahjong connect slide"],
  },

  "peak-rover": {
    title: "Peak Rover — Free 2D Hill Climb Driving Game Online, 600+ Stages",
    description: "Drive over hills, ramps and bridges, keep your fuel up and land your flips. A free 2D hill climb driving game with 600+ stages — play in your browser.",
    keywords: ["hill climb game", "hill climb driving", "2d driving game", "car physics game", "uphill driving game", "fuel driving game", "monster truck hill game"],
  },
  "gizmo-drive": {
    title: "Gizmo Drive — Free Physics Car Driving Game with Contraptions, 600+ Stages",
    description: "Drive a wobbly car over seesaws, lifts, loops and wrecking balls to the finish flag without flipping. A free 2D physics driving game — play in your browser.",
    keywords: ["physics driving game", "car physics game", "drive without flipping", "obstacle course car game", "2d driving game", "contraption car game", "stunt car levels game"],
  },
  "wake-racers": {
    title: "Wake Racers — Free 3D Speedboat Racing Game, 600+ Stages",
    description: "Race speedboats through lagoons, canyons, neon harbours and glacier fjords: jump ramps, ride waterfalls and beat the pack. A free 3D boat racing game — play in your browser.",
    keywords: ["boat racing game", "speedboat game", "3d boat game", "jet ski racing", "water racing game", "boat driving game", "powerboat racing online"],
  },
  "voxel-vanguard": {
    title: "Voxel Vanguard — Free 3D Pixel Shooter with a Jetpack, 1200 Operations",
    description: "Run, gun and jetpack with your squad through long missions against a robot army in a blocky 3D world. A free voxel third-person shooter with bosses — play in your browser.",
    keywords: ["pixel shooter game", "voxel shooter", "3d shooting game", "blocky gun game", "jetpack shooter", "robot shooter game", "third person shooter online"],
  },
  "rumble-rally": {
    title: "Rumble Rally — Free Monster Truck Racing Game with Rockets & Nitro, 600+ Races",
    description: "Race three rival monster trucks, ram them, fire homing rockets and burn nitro to the finish line. A free 2D monster truck racing game — play in your browser.",
    keywords: ["monster truck racing game", "monster truck race", "truck racing game", "2d monster truck game", "racing game with rockets", "nitro truck race", "monster truck challenge game"],
  },
  "crumble-crew": {
    title: "Crumble Crew — Free 3D Voxel Destruction Heist Game, Smash & Grab",
    description: "Smash into blocky buildings with a mallet, drill, guns and bombs, grab the gold and fight off robot security in a free 3D voxel destruction game. Play in your browser.",
    keywords: ["voxel destruction game", "smash buildings game", "heist game online", "destroy building game", "3d smash game", "block breaking game", "sledgehammer game", "robbery game browser", "voxel shooter with bombs"],
    updated: "2026-11-26",
  },
  "cube-clash": {
    title: "Cube Clash — Free 3D Sky Wars Block Shooter",
    description: "Bridge between sky islands, knock rivals into the void, break enemy crystals and survive zombie nights in a free 3D block shooter. Play in your browser.",
    keywords: ["sky wars game", "bed wars game online", "block shooter game", "3d block building game", "build and shoot game", "obby parkour game", "zombie survival block game", "blocky io style game"],
    updated: "2026-11-26",
  },
  "obby-bike-blaster": {
    title: "Obby Bike Blaster — 3D Pixel Bike Obby, 1200+ Levels",
    description: "Ride a pixel BMX through sky obby courses: jump gaps, dodge kill blocks and blast targets to open bridges. A free 3D bike obby game — play in your browser.",
    keywords: ["obby bike game", "bike obby", "obby on a bike", "3d obby game", "bicycle obby", "obby parkour game", "pixel obby game", "obby games online"],
  },
  blockstorm: {
    title: "Blockstorm — Free 3D Pixel Block Shooter, 1000+ Stages",
    description: "Blast blocky monsters and tear block towers down onto them in a free 3D pixel shooter with bosses, friends and 1000+ stages. Play in your browser.",
    keywords: ["block shooter game", "pixel shooter game", "3d blocky shooter", "voxel shooting game", "destroy blocks game", "monster shooting game", "blocky zombie shooter", "third person shooter online"],
  },
  "tumble-truck": {
    title: "Tumble Truck — Free Monster Truck Delivery Game, 600+ Stages",
    description: "Drive a monster truck with a loose load and deliver as much as you can over bumps, mud and bridges. A free 2D cargo truck game — play in your browser.",
    keywords: ["monster truck delivery game", "cargo truck game", "truck delivery game", "monster truck game", "2d truck physics game", "cargo transport game", "delivery driving game"],
  },
  "flutter-pairs": {
    title: "Flutter Pairs — Free 3D Stack Match Puzzle Online, 1000+ Levels",
    description: "Drop felt blocks on the stacks: matching pairs sprout wings and fly away, but never let a stack pass the rope. A cosy, hard 3D stack puzzle with 1000+ levels — play free.",
    keywords: ["stack puzzle", "match pairs puzzle", "block stacking game", "color match puzzle", "felt puzzle game", "logic puzzle online", "brain game"],
  },
  "skyrift-gems": {
    title: "Skyrift Gems — Free 3D Match 3 Duel Game Online, 1000+ Levels",
    description: "Match glittering gems on floating sky islands: make bombs and rainbow prisms, finish goal quests and win head-to-head duels. A free 3D match 3 game with 1000+ levels.",
    keywords: ["match 3", "match 3 games", "gem match", "jewel puzzle", "match three online", "3d match 3", "match 3 duel", "puzzle games online"],
  },
  "wiggle-way": {
    title: "Wiggle Way — Free 3D Gravity Worm Puzzle Online, 600+ Levels",
    description: "Eat apples, grow longer and wriggle into the portal before gravity pulls your worm down. A free, hard 3D worm puzzle with 600+ levels — play in your browser.",
    keywords: ["apple worm", "worm puzzle", "gravity worm game", "snake puzzle", "worm game online", "3d puzzle game", "brain puzzle"],
  },
  "bead-rush": {
    title: "Bead Rush — Free 3D Snake vs Blocks Runner Online, 600+ Levels",
    description: "Steer a bead snake up a 3D track, eat orbs to grow and chew through number blocks. A free, hard snake and blocks runner with 600+ levels — play in your browser.",
    keywords: ["snake vs block", "snake blocks game", "3d snake game", "snake runner", "number blocks game", "hyper snake", "arcade runner online"],
  },
  "neon-tac-duel": {
    title: "Neon Tac Duel — Free 3D Tic Tac Toe Puzzles Online, 600+ Levels",
    description: "Neon 3D tic tac toe with a twist: win in N moves against a rival that never misses a block. Gravity, pillars, Infinity marks and 600+ levels — play free in your browser.",
    keywords: ["tic tac toe", "tic tac toe 3d", "neon tic tac toe", "tic tac toe puzzle", "noughts and crosses", "4 in a row", "infinity tic tac toe", "strategy puzzle game"],
  },
  "band-bend": {
    title: "Band Bend — Free 3D Line Connect Rubber Band Puzzle, 600+ Levels",
    description: "Stretch rubber bands over the pins until they draw the shape on the card. A free, hard 3D line connect puzzle with 600+ levels — play in your browser.",
    keywords: ["line connect", "rubber band puzzle", "line puzzle 3d", "connect the lines game", "pegboard puzzle", "geometry puzzle online", "brain puzzle game"],
  },
  "rope-loop": {
    title: "Rope Loop — Free 3D Rope Color Sort Puzzle Online, 600+ Levels",
    description: "Wind coloured ropes from spool to spool until every colour has its own. A free, hard 3D rope colour sort puzzle with 600+ levels — play in your browser.",
    keywords: ["rope color sort", "rope sort 3d", "color sort puzzle", "spool sort game", "rope sort puzzle", "sorting game online", "3d puzzle game"],
  },
  "slide-splash": {
    title: "Slide Splash — Free Slide & Paint Maze Puzzle Online, 600+ Levels",
    description: "Swipe the cube to slide and paint every tile of the maze, and dodge the spiky mines. A free 3D slide paint puzzle with 600+ hard levels — play in your browser.",
    keywords: ["just slide", "slide and paint", "paint maze puzzle", "amaze game", "slide puzzle 3d", "maze painting game", "logic puzzle online"],
  },
  "plank-panic": {
    title: "Plank Panic — Free Wood Screw Puzzle Online, 600+ Levels",
    description: "Unscrew the bolts, move them to free holes and drop every wooden plank. A free 3D wood screw and nuts & bolts puzzle with 600+ levels — play in your browser.",
    keywords: ["wood screw puzzle", "screw puzzle", "nuts and bolts puzzle", "wood nuts bolts", "unscrew puzzle game", "screw pin puzzle", "brain puzzle online"],
  },
  "noodle-pups": {
    title: "Noodle Pups — Free Dogs Out Puzzle Game Online, 600+ Levels",
    description: "Tap the long noodle dogs to send them out of the yard in the right order. A free, hard dogs out logic puzzle with 600+ levels — play in your browser.",
    keywords: ["dogs out", "dogs out puzzle", "snake dog puzzle", "tap away puzzle", "dog escape puzzle", "logic puzzle online", "hard puzzle game"],
  },
  "arrow-unveil": {
    title: "Arrow Unveil — Free Arrow Slide Puzzle Online, 600+ Levels",
    description: "Tap the arrows to slide them off the board in the right order and reveal the hidden painting. A free arrow puzzle escape game with 600+ levels — play in your browser.",
    keywords: ["arrow slide puzzle", "arrows puzzle", "arrow escape puzzle", "arrow puzzle game", "tap away arrows", "logic puzzle online", "hidden picture puzzle"],
  },
  "melon-merge-fiesta": {
    title: "Melon Merge Fiesta — Free Watermelon Fruit Merge Game Online, 500+ Levels",
    description: "Drop cute fruits into a crate and merge equal ones all the way to the watermelon. A free watermelon fruit merge physics puzzle with 500+ levels, boosters and goals — play in your browser.",
    keywords: ["watermelon game", "fruit merge", "watermelon merge", "merge fruits game", "suika style game", "fruit drop puzzle", "watermelon fruit merge"],
  },
  "marble-merge-2048": {
    title: "Marble Merge 2048 — Free 2048 Balls Drop & Merge Game Online, 500+ Levels",
    description: "Drop numbered balls into a jar, merge equal balls and chain the pops to reach each level's goal. A free 2048 balls physics merge puzzle with 500+ levels — play in your browser.",
    keywords: ["2048 balls", "2048 ball merge", "merge balls game", "drop and merge balls", "2048 marble game", "number ball merge", "ball drop puzzle"],
  },
  "merge-nova": {
    title: "Merge Nova — Free Drop & Merge Numbers Game Online, 500+ Levels",
    description: "Drop number blocks, merge equal numbers and chain the combos to reach each level's goal. A free 2048-style drop merge puzzle with 500+ levels — play in your browser.",
    keywords: ["drop merge numbers", "2048 drop game", "merge numbers game", "number merge puzzle", "drop the number", "2048 online free", "merge block puzzle"],
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
  runner: "running game", adventure: "adventure game", racing: "racing game", shoot: "shooting game", puzzle: "puzzle game", brain: "brain game",
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
