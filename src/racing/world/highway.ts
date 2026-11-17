// Highway Heat worlds: 27 highways, freeways and interstates. Each borrows a Nitro Rush world's sky, scenery and
// backdrop and gets a real highway: 4 lanes (20 m) with dashed lane lines, long sweeping layouts (gentle curves,
// long straights for top speed), concrete or rail barriers, sign gantries, street lamps and roadside billboards.
import type { HazardKind, ThemeSpec, Weather } from "../types";
import { THEMES, type BarrierKind, type PropSpec, type RoadKind, type ThemeLook } from "./themes";
import { resolveLook } from "./build";

interface HDef {
  id: string; name: string; emoji: string; blurb: string; base: string; music: "chase" | "bigbeat";
  night?: boolean; weather?: Weather; accent?: string; width?: number;
  track: { curviness: number; hills: number; size: number };
  hazards?: HazardKind[];
  road?: Partial<ThemeLook["road"]> & { kind?: RoadKind };
  barrier?: { kind: BarrierKind; color: string };
  props?: PropSpec[];
}

const HIGHWAY_PROPS: PropSpec[] = [{ kind: "billboard", density: 0.9 }, { kind: "chevron", density: 0.5 }];
const ASPHALT: Partial<ThemeLook["road"]> = { kind: "asphalt", color: "#35373D", line: "#F4F1E6", edge: "#F2C230", centre: "dash" };

const H: HDef[] = [
  { id: "hh-sunny-interstate", name: "Sunny Interstate", emoji: "🛣️", base: "sunny-circuit", music: "chase", blurb: "A wide, sunny interstate through green hills — learn to weave the traffic.", track: { curviness: 0.2, hills: 0.25, size: 1.15 }, hazards: ["cones"] },
  { id: "hh-coast-1", name: "Coast Highway 1", emoji: "🌅", base: "sunset-coast", music: "chase", blurb: "Golden-hour cliffs and the ocean on your right. Don't look at the view!", track: { curviness: 0.3, hills: 0.45, size: 1.2 } },
  { id: "hh-neon-freeway", name: "Neon Freeway", emoji: "🌃", base: "neon-city", music: "bigbeat", blurb: "Eight lanes of light through a midnight city. The cops love this one.", track: { curviness: 0.28, hills: 0.1, size: 1.15 }, hazards: ["puddle", "cones"] },
  { id: "hh-desert-interstate", name: "Desert Interstate", emoji: "🏜️", base: "desert-canyon", music: "chase", blurb: "Mesas, cacti and a heat haze over a dead-straight desert road.", track: { curviness: 0.18, hills: 0.35, size: 1.3 }, hazards: ["rock", "spikes"] },
  { id: "hh-harbour-bridge", name: "Harbour Bridge", emoji: "🌉", base: "harbour-docks", music: "bigbeat", blurb: "Cranes, containers and a long bridge over the docks.", track: { curviness: 0.25, hills: 0.1, size: 1.2 }, barrier: { kind: "concrete", color: "#C9C6BE" } },
  { id: "hh-palm-parkway", name: "Palm Beach Parkway", emoji: "🏝️", base: "tropical-beach", music: "chase", blurb: "Palm trees, beach huts and blue sea along a breezy parkway.", track: { curviness: 0.28, hills: 0.25, size: 1.2 } },
  { id: "hh-farm-66", name: "Route 66 Farms", emoji: "🚜", base: "farmland", music: "chase", blurb: "Fields, barns and tractors that pull out in front of you.", track: { curviness: 0.25, hills: 0.35, size: 1.2 } },
  { id: "hh-autumn-turnpike", name: "Autumn Turnpike", emoji: "🍂", base: "autumn-forest", music: "chase", blurb: "Red and orange forests on a rolling turnpike.", track: { curviness: 0.32, hills: 0.5, size: 1.2 } },
  { id: "hh-rain-expressway", name: "Rainy Expressway", emoji: "🌧️", base: "rainy-metro", music: "bigbeat", blurb: "Spray, puddles and brake lights on a stormy city expressway.", track: { curviness: 0.3, hills: 0.15, size: 1.15 }, hazards: ["puddle", "oil", "cones"] },
  { id: "hh-sakura-expressway", name: "Sakura Expressway", emoji: "🌸", base: "cherry-blossom", music: "chase", blurb: "Pink blossom drifting over a smooth mountain expressway.", track: { curviness: 0.32, hills: 0.4, size: 1.2 } },
  { id: "hh-alpine-autobahn", name: "Alpine Autobahn", emoji: "🏔️", base: "snowy-alps", music: "bigbeat", blurb: "A snowy autobahn with no speed limit — and icy patches.", track: { curviness: 0.28, hills: 0.6, size: 1.25 }, road: { kind: "asphalt", color: "#3C3F46", line: "#FFFFFF", edge: "#FFFFFF", centre: "dash" } },
  { id: "hh-canyon-night", name: "Canyon Night Run", emoji: "🌙", base: "desert-canyon", music: "bigbeat", night: true, blurb: "The desert interstate after dark: stars above, sirens behind.", track: { curviness: 0.22, hills: 0.4, size: 1.25 }, hazards: ["rock", "spikes"] },
  { id: "hh-wild-west", name: "Wild West Highway", emoji: "🤠", base: "wild-west", music: "chase", blurb: "Saloons and cattle grids on a dusty frontier highway.", track: { curviness: 0.3, hills: 0.35, size: 1.2 } },
  { id: "hh-pyramid-highway", name: "Pyramid Highway", emoji: "🐫", base: "egyptian-dunes", music: "chase", blurb: "A desert highway past the pyramids and the Sphinx.", track: { curviness: 0.25, hills: 0.4, size: 1.25 }, hazards: ["rock", "spikes"] },
  { id: "hh-lavender-route", name: "Lavender Route", emoji: "💜", base: "lavender-fields", music: "chase", blurb: "Purple fields and stone villages on a sunny route nationale.", track: { curviness: 0.32, hills: 0.4, size: 1.2 } },
  { id: "hh-savanna-highway", name: "Savanna Highway", emoji: "🦒", base: "safari-savanna", music: "chase", blurb: "Acacias, giraffes and a long red-earth horizon.", track: { curviness: 0.25, hills: 0.3, size: 1.3 } },
  { id: "hh-jungle-expressway", name: "Jungle Expressway", emoji: "🗿", base: "jungle-ruins", music: "bigbeat", blurb: "A highway carved through misty rainforest and ruins.", track: { curviness: 0.34, hills: 0.45, size: 1.2 } },
  { id: "hh-haunted-highway", name: "Haunted Highway", emoji: "🎃", base: "haunted-town", music: "bigbeat", blurb: "Fog, pumpkins and ghostly headlights. Who's driving that bus?", track: { curviness: 0.32, hills: 0.3, size: 1.15 }, hazards: ["oil", "spikes"] },
  { id: "hh-volcano-pass", name: "Volcano Pass", emoji: "🌋", base: "volcano", music: "bigbeat", blurb: "Black basalt and lava glow on a scorching mountain pass.", track: { curviness: 0.34, hills: 0.55, size: 1.2 }, hazards: ["fire", "rock"] },
  { id: "hh-fjord-road", name: "Fjord Coast Road", emoji: "⛵", base: "viking-fjords", music: "chase", blurb: "Steep cliffs, waterfalls and a cold blue fjord.", track: { curviness: 0.34, hills: 0.6, size: 1.25 } },
  { id: "hh-glacier-route", name: "Glacier Route", emoji: "🧊", base: "ice-glacier", music: "bigbeat", blurb: "Ice tunnels and glassy roads through a frozen world.", track: { curviness: 0.3, hills: 0.5, size: 1.2 }, road: { kind: "asphalt", color: "#3E4450", line: "#FFFFFF", edge: "#5FD3F5", centre: "dash" } },
  { id: "hh-candy-freeway", name: "Candy Freeway", emoji: "🍭", base: "candy-land", music: "chase", blurb: "A sugar-coated freeway with gumdrop traffic cones.", track: { curviness: 0.32, hills: 0.35, size: 1.15 }, road: { kind: "candy", color: "#F7C6DE", line: "#FFFFFF", edge: "#FF5FA2", centre: "dash" } },
  { id: "hh-cyber-superhighway", name: "Cyber Superhighway", emoji: "💠", base: "cyber-grid", music: "bigbeat", blurb: "A glowing data highway. The cops here are pure light.", track: { curviness: 0.34, hills: 0.3, size: 1.15 }, road: { kind: "grid", color: "#0A0A14", line: "#00E5FF", edge: "#FF3FD8", centre: "dash" } },
  { id: "hh-aurora-highway", name: "Aurora Highway", emoji: "🌌", base: "arctic-aurora", music: "bigbeat", blurb: "Northern lights over a snowy night highway.", track: { curviness: 0.3, hills: 0.5, size: 1.25 }, road: { kind: "asphalt", color: "#383C44", line: "#FFFFFF", edge: "#E8504F", centre: "dash" } },
  { id: "hh-moon-expressway", name: "Moon Expressway", emoji: "🌕", base: "moon-base", music: "bigbeat", blurb: "A lunar expressway between domes and rockets.", track: { curviness: 0.32, hills: 0.35, size: 1.2 }, road: { kind: "metal", color: "#5A5E66", line: "#F2C230", edge: "#4FC3FF", centre: "dash" } },
  { id: "hh-mars-interstate", name: "Mars Interstate", emoji: "🔴", base: "mars-red-planet", music: "chase", blurb: "Rust-red canyons on the first highway on Mars.", track: { curviness: 0.32, hills: 0.55, size: 1.3 }, road: { kind: "regolith", color: "#7A3A26", line: "#F2E6D0", edge: "#4FC3FF", centre: "dash" } },
  { id: "hh-rainbow-skyway", name: "Rainbow Skyway", emoji: "🌈", base: "rainbow-sky-road", music: "bigbeat", accent: "#FFC600", blurb: "The final run on a rainbow road in the clouds. Become the Heat King!", track: { curviness: 0.36, hills: 0.7, size: 1.2 }, road: { kind: "rainbow", color: "#FFFFFF", line: "#FFFFFF", edge: "#FFFFFF", centre: "dash" } },
];

function highway(v: HDef, order: number): ThemeSpec {
  const b = THEMES.find((t) => t.id === v.base);
  if (!b) throw new Error(`highway base missing: ${v.base}`);
  const night = v.night ?? b.night;
  const baseLook = night !== b.night ? resolveLook(b, night, b.weather) : (b.look as unknown as ThemeLook);
  const keepRoad = ["candy", "grid", "rainbow", "metal", "regolith", "basalt", "glass", "wet"].includes(baseLook.road.kind);
  const look: ThemeLook = {
    ...baseLook,
    road: { ...(keepRoad ? baseLook.road : { ...baseLook.road, ...ASPHALT }), ...(v.road ?? {}), centre: "dash" } as ThemeLook["road"],
    barrier: v.barrier ?? (["rail", "concrete", "neon", "glass", "ice", "candy", "snowbank"].includes(baseLook.barrier.kind) ? baseLook.barrier : { kind: "concrete", color: "#C9C6BE" }),
    curbs: "none",
    props: [...baseLook.props.filter((p) => p.kind !== "grandstand" && p.kind !== "flags" && p.kind !== "tyres"), ...HIGHWAY_PROPS, ...(v.props ?? [])],
    overhead: { kind: "gantry", every: 420 },
    lamps: baseLook.lamps ?? { kind: "street", color: night ? "#FFB45A" : "#FFE2B0", every: 46 },
  };
  return {
    id: v.id, name: v.name, emoji: v.emoji, blurb: v.blurb, order,
    night, weather: v.weather ?? b.weather, music: v.music, accent: v.accent ?? b.accent,
    track: { width: v.width ?? 20, ...v.track }, hazards: v.hazards ?? ["cones", "oil", "spikes"],
    look: look as unknown as Record<string, unknown>,
  };
}

export const HIGHWAY_THEMES: ThemeSpec[] = H.map((v, i) => highway(v, i));
