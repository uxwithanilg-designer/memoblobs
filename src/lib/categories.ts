// The shelves (categories), in menu order. Small and shared by every page (menus, footer, search); the games themselves
// are in src/lib/games.ts. Each game sits on exactly one shelf.

export type Category = "runner" | "adventure" | "racing" | "puzzle" | "brain" | "memory" | "focus" | "reflex" | "numbers";

export const CATEGORIES: { id: Category; label: string; emoji: string; blurb: string }[] = [
  { id: "runner", label: "Runner", emoji: "🏃", blurb: "Endless 3D runs: swipe, dodge, roll and dash as fast as you can." },
  { id: "adventure", label: "Adventure", emoji: "🗺️", blurb: "Big 3D worlds to climb, bounce, blast and march through, stage after stage." },
  { id: "racing", label: "Racing", emoji: "🏎️", blurb: "3D car, drift, highway and motorbike races with nitro and 30+ rides." },
  { id: "puzzle", label: "Puzzle", emoji: "🧩", blurb: "Slide, squish, connect and solve — puzzles that make you plan ahead." },
  { id: "brain", label: "Brain", emoji: "🧠", blurb: "Logic, patterns and odd-one-out teasers that make you think." },
  { id: "memory", label: "Memory", emoji: "💡", blurb: "Watch, remember and repeat — sequences, pairs and orders." },
  { id: "focus", label: "Focus", emoji: "🎯", blurb: "Keep your eyes sharp: spot, track and find what changed." },
  { id: "reflex", label: "Reflex", emoji: "⚡", blurb: "Quick taps and quick eyes — catch, bonk and react in time." },
  { id: "numbers", label: "Numbers", emoji: "🔢", blurb: "Count, add and compare against the clock." },
];
