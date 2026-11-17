// Moto Rush GP circuits: 27 Grand Prix tracks. Each borrows a Nitro Rush world's sky and scenery and becomes a real
// bike circuit: a narrow 13 m track with long sweepers and hairpins, red-and-white kerbs on every corner, gravel
// run-off, tyre walls, grandstands, flags and floodlights.
import type { HazardKind, ThemeSpec, Weather } from "../types";
import { THEMES, type BarrierKind, type PropSpec, type ThemeLook } from "./themes";
import { resolveLook } from "./build";

interface MDef {
  id: string; name: string; emoji: string; blurb: string; base: string; music: "metal" | "hardstyle";
  night?: boolean; weather?: Weather; accent?: string;
  track: { curviness: number; hills: number; size: number };
  hazards?: HazardKind[];
  barrier?: { kind: BarrierKind; color: string };
}

const PADDOCK: PropSpec[] = [{ kind: "grandstand", density: 0.7 }, { kind: "tyres", density: 0.9 }, { kind: "flags", density: 0.8 }, { kind: "floodlight", density: 0.35 }, { kind: "billboard", density: 0.6 }, { kind: "chevron", density: 0.9 }];

const M: MDef[] = [
  { id: "mr-sunny-raceway", name: "Sunny Raceway", emoji: "🏁", base: "sunny-circuit", music: "hardstyle", blurb: "A friendly green circuit with wide kerbs — learn to lean!", track: { curviness: 0.45, hills: 0.25, size: 0.85 }, hazards: ["cones"] },
  { id: "mr-coastal-gp", name: "Coastal GP", emoji: "🏖️", base: "tropical-beach", music: "metal", blurb: "Palm trees and sea spray on a fast seaside circuit.", track: { curviness: 0.5, hills: 0.25, size: 0.9 } },
  { id: "mr-neon-night-gp", name: "Neon Night GP", emoji: "🌃", base: "neon-city", music: "hardstyle", blurb: "A floodlit street circuit through glowing skyscrapers.", track: { curviness: 0.55, hills: 0.1, size: 0.85 } },
  { id: "mr-desert-circuit", name: "Desert Circuit", emoji: "🏜️", base: "desert-canyon", music: "metal", blurb: "Long sweepers between red mesas. Full throttle!", track: { curviness: 0.5, hills: 0.4, size: 0.95 } },
  { id: "mr-harbour-street", name: "Harbour Street Circuit", emoji: "⚓", base: "harbour-docks", music: "metal", blurb: "Tight hairpins between shipping containers.", track: { curviness: 0.62, hills: 0.05, size: 0.85 } },
  { id: "mr-cherry-ring", name: "Cherry Ring", emoji: "🌸", base: "cherry-blossom", music: "hardstyle", blurb: "Pink petals over a flowing, technical circuit.", track: { curviness: 0.58, hills: 0.4, size: 0.9 } },
  { id: "mr-forest-ring", name: "Forest Ring", emoji: "🍂", base: "autumn-forest", music: "metal", blurb: "Up and down through the autumn woods. Blind crests!", track: { curviness: 0.6, hills: 0.6, size: 0.95 } },
  { id: "mr-farm-track", name: "Farm Track", emoji: "🚜", base: "farmland", music: "hardstyle", blurb: "A country circuit between wheat fields and barns.", track: { curviness: 0.55, hills: 0.4, size: 0.9 } },
  { id: "mr-rainy-raceway", name: "Rainy Raceway", emoji: "🌧️", base: "rainy-metro", music: "metal", blurb: "Wet tarmac, spray and slippery kerbs. Lean gently!", track: { curviness: 0.58, hills: 0.15, size: 0.85 }, hazards: ["puddle", "oil"] },
  { id: "mr-alpine-circuit", name: "Alpine Circuit", emoji: "🏔️", base: "snowy-alps", music: "metal", blurb: "A mountain circuit with snowy peaks all around.", track: { curviness: 0.6, hills: 0.7, size: 0.95 } },
  { id: "mr-sunset-gp", name: "Sunset GP", emoji: "🌅", base: "sunset-coast", music: "hardstyle", blurb: "Golden light on cliff-top sweepers.", track: { curviness: 0.55, hills: 0.5, size: 0.95 } },
  { id: "mr-jungle-gp", name: "Jungle GP", emoji: "🗿", base: "jungle-ruins", music: "metal", blurb: "A misty rainforest circuit past ancient ruins.", track: { curviness: 0.62, hills: 0.45, size: 0.9 } },
  { id: "mr-wild-west", name: "Wild West Speedway", emoji: "🤠", base: "wild-west", music: "metal", blurb: "Saloons, cacti and a dusty frontier speedway.", track: { curviness: 0.55, hills: 0.3, size: 0.9 } },
  { id: "mr-pyramid-circuit", name: "Pyramid Circuit", emoji: "🐫", base: "egyptian-dunes", music: "hardstyle", blurb: "Race past the pyramids in the desert sun.", track: { curviness: 0.55, hills: 0.4, size: 0.95 } },
  { id: "mr-lavender-ring", name: "Lavender Ring", emoji: "💜", base: "lavender-fields", music: "hardstyle", blurb: "Purple fields and a rhythm of S-bends.", track: { curviness: 0.6, hills: 0.4, size: 0.9 } },
  { id: "mr-savanna-speedway", name: "Savanna Speedway", emoji: "🦒", base: "safari-savanna", music: "metal", blurb: "Wide open savanna and the fastest straight in Africa.", track: { curviness: 0.5, hills: 0.3, size: 1.0 } },
  { id: "mr-haunted-gp", name: "Haunted Night GP", emoji: "🎃", base: "haunted-town", music: "metal", blurb: "Foggy, spooky, floodlit. Don't look at the graveyard!", track: { curviness: 0.6, hills: 0.3, size: 0.9 }, hazards: ["oil", "puddle"] },
  { id: "mr-shrine-circuit", name: "Shrine Circuit", emoji: "⛩️", base: "shrine-mountains", music: "hardstyle", blurb: "Red torii gates and a twisting mountain circuit.", track: { curviness: 0.66, hills: 0.6, size: 0.9 } },
  { id: "mr-volcano-ring", name: "Volcano Ring", emoji: "🌋", base: "volcano", music: "metal", blurb: "Black basalt and glowing lava on every side.", track: { curviness: 0.64, hills: 0.55, size: 0.95 }, hazards: ["fire", "oil"] },
  { id: "mr-fjord-gp", name: "Fjord GP", emoji: "⛵", base: "viking-fjords", music: "metal", blurb: "Cold blue water and steep cliffs. Big elevation!", track: { curviness: 0.6, hills: 0.7, size: 1.0 } },
  { id: "mr-glacier-ring", name: "Glacier Ring", emoji: "🧊", base: "ice-glacier", music: "hardstyle", blurb: "Ice caves and a frozen, shimmering circuit.", track: { curviness: 0.6, hills: 0.5, size: 0.95 } },
  { id: "mr-candy-circuit", name: "Candy Circuit", emoji: "🍭", base: "candy-land", music: "hardstyle", blurb: "Lollipops, gumdrops and sugar-coated kerbs.", track: { curviness: 0.62, hills: 0.4, size: 0.9 } },
  { id: "mr-cyber-gp", name: "Cyber GP", emoji: "💠", base: "cyber-grid", music: "hardstyle", blurb: "A glowing digital circuit. Lean through the light.", track: { curviness: 0.66, hills: 0.3, size: 0.9 } },
  { id: "mr-aurora-gp", name: "Aurora Night GP", emoji: "🌌", base: "arctic-aurora", music: "metal", blurb: "Northern lights over a snowy night circuit.", track: { curviness: 0.62, hills: 0.5, size: 0.95 } },
  { id: "mr-moon-ring", name: "Moon Ring", emoji: "🌙", base: "moon-base", music: "hardstyle", blurb: "Low gravity GP — the wheelies last forever.", track: { curviness: 0.62, hills: 0.4, size: 0.95 } },
  { id: "mr-mars-gp", name: "Mars GP", emoji: "🔴", base: "mars-red-planet", music: "metal", blurb: "The first Grand Prix on the red planet.", track: { curviness: 0.66, hills: 0.6, size: 1.0 } },
  { id: "mr-rainbow-gp", name: "Rainbow Grand Prix", emoji: "🌈", base: "rainbow-sky-road", music: "hardstyle", accent: "#FFD400", blurb: "The title decider on a rainbow circuit in the sky. Become the Moto King!", track: { curviness: 0.7, hills: 0.8, size: 1.0 } },
];

function circuit(v: MDef, order: number): ThemeSpec {
  const b = THEMES.find((t) => t.id === v.base);
  if (!b) throw new Error(`moto base missing: ${v.base}`);
  const night = v.night ?? b.night;
  const baseLook = night !== b.night ? resolveLook(b, night, b.weather) : (b.look as unknown as ThemeLook);
  const look: ThemeLook = {
    ...baseLook,
    // a race circuit: no lane lines, just the white edge lines and kerbs
    road: { ...baseLook.road, centre: "none" },
    curbs: "full",
    curb: ["#E10600", "#F5F5F7"],
    barrier: v.barrier ?? (["rail", "concrete", "neon", "glass", "ice", "candy", "snowbank"].includes(baseLook.barrier.kind) ? { kind: "tires", color: "#1F2937" } : baseLook.barrier),
    props: [...baseLook.props.filter((p) => !["grandstand", "flags", "tyres", "floodlight", "chevron"].includes(p.kind)), ...PADDOCK],
    overhead: baseLook.overhead?.kind === "gantry" ? { kind: "gantry", every: 900 } : baseLook.overhead,
  };
  return {
    id: v.id, name: v.name, emoji: v.emoji, blurb: v.blurb, order,
    night, weather: v.weather ?? b.weather, music: v.music, accent: v.accent ?? b.accent,
    track: { width: 13, ...v.track }, hazards: v.hazards ?? ["cones", "oil"],
    look: look as unknown as Record<string, unknown>,
  };
}

export const MOTO_THEMES: ThemeSpec[] = M.map((v, i) => circuit(v, i));
