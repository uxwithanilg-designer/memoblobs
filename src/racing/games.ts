// The racing games that run on this engine. Each one picks its garage, its worlds, its career recipe, the events
// offered in Quick Race, the featured single-drive mode on the title screen and its physics style.
// getCar / getTheme look across every game (ids are unique), so a saved car or a race config always resolves.
import type { CarSpec, ModeId, ThemeSpec } from "./types";
import { CARS } from "./cars/specs";
import { DRIFT_CARS } from "./cars/drift";
import { THEMES } from "./world/themes";
import { DRIFT_THEMES } from "./world/drift";
import { HIGHWAY_CARS, HIGHWAY_COP_CAR, HIGHWAY_TRAFFIC } from "./cars/highway";
import { HIGHWAY_THEMES } from "./world/highway";
import { MOTO_BIKES } from "./cars/moto";
import { MOTO_THEMES } from "./world/moto";
import type { CareerStyle } from "./levels";
import type { MusicName } from "@/lib/audio";

export interface RacingGame {
  slug: string;
  /** small caps line above the logo on the title screen */
  kicker: string;
  /** physics + scoring: "drift" makes slides easier and bigger, scores drift chains and lets the AI show off */
  style: "race" | "drift" | "bike";
  career: CareerStyle;
  cars: CarSpec[];
  themes: ThemeSpec[];
  /** events offered in Quick Race, in order */
  modes: ModeId[];
  /** the big second button on the title screen */
  feature: { mode: ModeId; label: string };
  /** rival car for quick-race duels / battles when none is chosen */
  bossCar: string;
  /** look & sound of the menus and HUD: "arcade" (Nitro Rush: candy-glossy purple/orange) or "street" (Drift Kings:
   *  midnight asphalt, neon pink/cyan, slanted sharp buttons, motorsport font, gear-shift / turbo UI sounds) */
  skin: "arcade" | "street" | "highway" | "moto";
  /** music loop for the menus */
  menuMusic: MusicName;
  /** Highway Heat: civilian traffic (car ids, how many on the road) and the police car */
  traffic?: { cars: string[]; count: number };
  copCar?: string;
}

export const RACING_GAMES: Record<string, RacingGame> = {
  "nitro-rush": {
    slug: "nitro-rush", kicker: "MOMOBLOBS RACING", style: "race", career: "race",
    cars: CARS, themes: THEMES,
    modes: ["race", "coinrush", "timetrial", "elimination", "duel"],
    feature: { mode: "coinrush", label: "COIN RUSH" },
    bossCar: CARS[CARS.length - 1].id,
    skin: "arcade", menuMusic: "a:race_menu_calm",
  },
  "drift-kings": {
    slug: "drift-kings", kicker: "MOMOBLOBS DRIFT", style: "drift", career: "drift",
    cars: DRIFT_CARS, themes: DRIFT_THEMES,
    modes: ["drift", "battle", "rally", "race", "coinrush", "elimination"],
    feature: { mode: "drift", label: "DRIFT ATTACK" },
    bossCar: DRIFT_CARS[DRIFT_CARS.length - 1].id,
    skin: "street", menuMusic: "a:race_phonk_calm",
  },
  "highway-heat": {
    slug: "highway-heat", kicker: "MOMOBLOBS HIGHWAY PATROL", style: "race", career: "highway",
    cars: HIGHWAY_CARS, themes: HIGHWAY_THEMES,
    modes: ["heat", "escape", "takedown", "race", "coinrush"],
    feature: { mode: "heat", label: "HEAT RUN" },
    bossCar: HIGHWAY_CARS[HIGHWAY_CARS.length - 1].id,
    skin: "highway", menuMusic: "a:race_chase_calm",
    traffic: { cars: HIGHWAY_TRAFFIC, count: 16 }, copCar: HIGHWAY_COP_CAR,
  },
  "moto-rush": {
    slug: "moto-rush", kicker: "MOMOBLOBS MOTO SERIES", style: "bike", career: "moto",
    cars: MOTO_BIKES, themes: MOTO_THEMES,
    modes: ["race", "wheelie", "timetrial", "duel", "elimination", "coinrush"],
    feature: { mode: "wheelie", label: "WHEELIES" },
    bossCar: MOTO_BIKES[MOTO_BIKES.length - 1].id,
    skin: "moto", menuMusic: "a:race_hardstyle_calm",
  },
};

const ALL_CARS = new Map<string, CarSpec>();
const ALL_THEMES = new Map<string, ThemeSpec>();
for (const g of Object.values(RACING_GAMES)) {
  for (const c of g.cars) ALL_CARS.set(c.id, c);
  for (const t of g.themes) ALL_THEMES.set(t.id, t);
}

let active: RacingGame = RACING_GAMES["nitro-rush"];
/** the racing app mounts one game at a time; screens read their lists from it */
export function setActiveGame(slug: string) { active = RACING_GAMES[slug] ?? RACING_GAMES["nitro-rush"]; return active; }
export const activeGame = () => active;
export const gameOf = (slug?: string) => (slug && RACING_GAMES[slug]) || active;

export const getCar = (id: string) => ALL_CARS.get(id) ?? active.cars[0];
export const getTheme = (id: string) => ALL_THEMES.get(id) ?? active.themes[0];
