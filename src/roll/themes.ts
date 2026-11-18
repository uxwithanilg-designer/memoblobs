// Worlds and moods. A world (Clay Garden, Candy Kitchen, …) has 3+ moods; a level moves through several moods (one
// per zone) and on every zone change the sky, light, fog, props, particles, ambience and music morph to the next.
// The data lives in data/worlds.ts; this module holds the shapes and lookups.
import { MOOD_LIST, WORLD_LIST } from "./data/worlds";

/** ambient particles the renderer knows how to draw */
export type Particles =
  | "petals" | "pollen" | "spores" | "leaves" | "fireflies" | "clippings" | "snow" | "bubbles" | "embers" | "sparks"
  | "notes" | "confetti" | "dust" | "stars" | "rain" | "sand" | "glitter" | "ash";
/** ambient soundscapes the sound engine knows how to make */
export type Ambience =
  | "birds" | "bees" | "drips" | "breeze" | "crickets" | "storm" | "waves" | "wind" | "hum" | "crowd" | "chimes"
  | "bubbles" | "crackle" | "owls" | "none";

/** prop kinds are free strings; every kind used by a mood must exist in art/props.ts `propGeometry` */
export type PropKind = string;

export interface Mood {
  id: string;
  /** owning world id (1–30) */
  world: number;
  name: string;
  emoji: string;
  /** sky gradient: zenith, horizon, far below (seen through the tile gaps) */
  sky: [number, number, number];
  fog: number;
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  /** checker of tile tops */
  tileA: number;
  tileB: number;
  /** tile sides */
  side: number;
  /** tint colours per prop kind (the tint-masked parts take one of these) */
  props: Record<PropKind, number[]>;
  /** relative prop mix on the side islands */
  mix: Record<PropKind, number>;
  /** the floating island prop kind under the side props (default "island") */
  island?: PropKind;
  cloud: number;
  particles: Particles;
  ambience: Ambience;
  /** 0..1 stars in the sky (night moods) */
  stars: number;
  /** bead colours */
  beads: number[];
  /** ball trail colour */
  trail: number;
  /** fog distance multiplier (default 1; < 1 = thicker) */
  fogK?: number;
}

export interface World {
  id: number;
  name: string;
  emoji: string;
  /** host character id (momo, kranky, tiki, pip, gloop, hoot, bonbon, zib, turbo, bolt, noodle) */
  host: string;
  /** default music style "M01".."M20" */
  style: string;
  /** mood ids, first = the world's signature mood */
  moods: string[];
  blurb: string;
  /** bonus themes (21–30) only appear in Infinite Fusion, Daily and the Lab */
  bonus?: boolean;
}

export const MOODS: Record<string, Mood> = Object.fromEntries(MOOD_LIST.map((m) => [m.id, m]));
export const WORLDS: World[] = WORLD_LIST;
export const worldOf = (id: number) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
export const moodOf = (id: string) => MOODS[id] ?? MOODS.meadow;

export const WORLD_NAME = "Clay Garden";
