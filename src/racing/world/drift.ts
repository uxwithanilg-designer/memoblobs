// Drift Kings venues: 27 drift arenas, mountain touge passes and rally stages. Each venue borrows a Nitro Rush
// world's sky, scenery and backdrop, then gets its own road: a new layout seed (every venue id makes a different
// track), drift-friendly geometry (tighter, twistier, narrower passes), its own surface (rally stages run on dirt,
// sand or snow), time of day, barriers (tyre walls for the arenas), drift-arena props and music.
import type { HazardKind, ThemeSpec, Weather } from "../types";
import { THEMES, type BarrierKind, type PropSpec, type RoadKind, type ThemeLook } from "./themes";
import { resolveLook } from "./build";

interface VDef {
  id: string; name: string; emoji: string; blurb: string; base: string;
  music: string; accent?: string; night?: boolean; weather?: Weather;
  track: { width: number; curviness: number; hills: number; size: number };
  hazards?: HazardKind[];
  road?: Partial<ThemeLook["road"]> & { kind?: RoadKind };
  barrier?: { kind: BarrierKind; color: string };
  curbs?: ThemeLook["curbs"];
  /** extra scenery on top of the base world's */
  props?: PropSpec[];
  /** "arena" adds tyre stacks, flags, floodlights and stands; "rally" adds flags and hay bales */
  dress?: "arena" | "rally" | "touge";
}

const ARENA: PropSpec[] = [{ kind: "tyres", density: 1.1 }, { kind: "flags", density: 0.7 }, { kind: "floodlight", density: 0.45 }, { kind: "grandstand", density: 0.35 }, { kind: "chevron", density: 0.9 }];
const RALLY: PropSpec[] = [{ kind: "flags", density: 0.55 }, { kind: "haybale", density: 0.5 }, { kind: "chevron", density: 0.6 }];
const TOUGE: PropSpec[] = [{ kind: "chevron", density: 1.1 }, { kind: "tyres", density: 0.35 }];

const V: VDef[] = [
  { id: "dk-drift-school", name: "Drift School", emoji: "🏫", base: "sunny-circuit", music: "eurobeat", dress: "arena",
    blurb: "A sunny practice circuit with tyre walls — learn to link your first slides.",
    track: { width: 17, curviness: 0.42, hills: 0.15, size: 0.8 }, hazards: ["cones"], barrier: { kind: "tires", color: "#1F2937" } },
  { id: "dk-harbour-night", name: "Harbour Night", emoji: "⚓", base: "harbour-docks", music: "phonk", night: true, dress: "arena",
    blurb: "Container stacks, crane lights and a slick dock road after midnight.",
    track: { width: 15.5, curviness: 0.55, hills: 0.05, size: 0.85 }, hazards: ["oil", "cones"], barrier: { kind: "tires", color: "#1F2937" } },
  { id: "dk-touge-pass", name: "Touge Pass", emoji: "⛰️", base: "shrine-mountains", music: "eurobeat", dress: "touge", accent: "#E8504F",
    blurb: "A narrow mountain pass of hairpins between torii gates — the home of drifting.",
    track: { width: 13.5, curviness: 0.72, hills: 0.75, size: 0.95 }, hazards: ["rock", "cones"],
    road: { kind: "asphalt", color: "#3E3F44", line: "#F2D06B", edge: "#FFFFFF", centre: "solid" }, barrier: { kind: "rail", color: "#C9CED6" } },
  { id: "dk-neon-highway", name: "Neon Highway", emoji: "🌃", base: "neon-city", music: "phonk", dress: "arena",
    blurb: "Wet city streets under neon signs. Every slide lights up the night.",
    track: { width: 15.5, curviness: 0.55, hills: 0.1, size: 0.9 }, hazards: ["puddle", "cones"] },
  { id: "dk-forest-rally", name: "Forest Gravel Rally", emoji: "🍂", base: "autumn-forest", music: "phonk", dress: "rally",
    blurb: "A gravel stage through orange autumn woods. Listen to your co-driver!",
    track: { width: 13.5, curviness: 0.6, hills: 0.6, size: 1.0 }, hazards: ["rock", "puddle"],
    road: { kind: "dirt", color: "#8A6A48", line: "none", edge: "none", centre: "none" }, curbs: "none", barrier: { kind: "wood", color: "#7A5233" } },
  { id: "dk-sakura-touge", name: "Sakura Touge", emoji: "🌸", base: "cherry-blossom", music: "eurobeat", dress: "touge",
    blurb: "Cherry blossoms drift down while you drift through the switchbacks.",
    track: { width: 14, curviness: 0.66, hills: 0.6, size: 0.95 }, hazards: ["puddle", "cones"] },
  { id: "dk-desert-rally", name: "Canyon Rally", emoji: "🏜️", base: "desert-canyon", music: "phonk", dress: "rally",
    blurb: "Red dust, mesas and long sweeping slides on a sandy rally road.",
    track: { width: 15, curviness: 0.55, hills: 0.5, size: 1.05 }, hazards: ["rock", "oil"],
    road: { kind: "sand", color: "#C99A62", line: "none", edge: "none", centre: "none" }, curbs: "none", barrier: { kind: "rocks", color: "#A0603E" } },
  { id: "dk-rain-metro", name: "Rainy Metro Drift", emoji: "🌧️", base: "rainy-metro", music: "phonk", dress: "arena",
    blurb: "A storm-soaked downtown circuit. Wet tarmac means huge, slow-motion slides.",
    track: { width: 15, curviness: 0.6, hills: 0.1, size: 0.9 }, hazards: ["puddle", "cones", "oil"], barrier: { kind: "tires", color: "#1F2937" } },
  { id: "dk-alpine-stage", name: "Alpine Snow Stage", emoji: "🏔️", base: "snowy-alps", music: "eurobeat", dress: "rally",
    blurb: "A snowy rally stage between pine trees. Brake early, slide wide, stay brave.",
    track: { width: 14, curviness: 0.6, hills: 0.75, size: 1.0 }, hazards: ["rock", "puddle"] },
  { id: "dk-sunset-coast", name: "Sunset Coast Run", emoji: "🌅", base: "sunset-coast", music: "eurobeat", dress: "touge",
    blurb: "Golden-hour cliff roads above the sea. Fast sweepers for long, long chains.",
    track: { width: 15, curviness: 0.55, hills: 0.55, size: 1.05 }, hazards: ["cones", "oil"] },
  { id: "dk-jungle-mud", name: "Jungle Mud Rally", emoji: "🗿", base: "jungle-ruins", music: "phonk", dress: "rally",
    blurb: "Muddy jungle trails past ancient ruins. Slippery, twisty and loud.",
    track: { width: 13.5, curviness: 0.66, hills: 0.5, size: 1.0 }, hazards: ["rock", "puddle"],
    road: { kind: "dirt", color: "#6E5236", line: "none", edge: "none", centre: "none" }, curbs: "none" },
  { id: "dk-dust-town", name: "Dust Town Rally", emoji: "🤠", base: "wild-west", music: "phonk", dress: "rally",
    blurb: "A dusty Wild West stage. Kick up clouds past the saloon!",
    track: { width: 14.5, curviness: 0.62, hills: 0.4, size: 1.0 }, hazards: ["rock", "oil"] },
  { id: "dk-pharaoh-sands", name: "Pharaoh Sands", emoji: "🐫", base: "egyptian-dunes", music: "phonk", dress: "rally",
    blurb: "A sand rally between the pyramids. Long sliding arcs in the desert sun.",
    track: { width: 15, curviness: 0.58, hills: 0.5, size: 1.05 }, hazards: ["rock", "spikes"],
    road: { kind: "sand", color: "#D2B07A", line: "none", edge: "none", centre: "none" }, curbs: "none" },
  { id: "dk-lavender-hills", name: "Lavender Hills", emoji: "💜", base: "lavender-fields", music: "eurobeat", dress: "touge",
    blurb: "Purple fields and stone walls on a twisty country road.",
    track: { width: 14, curviness: 0.64, hills: 0.5, size: 1.0 }, hazards: ["puddle", "cones"] },
  { id: "dk-safari-rally", name: "Safari Rally", emoji: "🦒", base: "safari-savanna", music: "phonk", dress: "rally",
    blurb: "Red-earth tracks across the savanna. Watch out for curious giraffes!",
    track: { width: 15, curviness: 0.6, hills: 0.4, size: 1.1 }, hazards: ["rock", "puddle"] },
  { id: "dk-haunted-drift", name: "Haunted Drift", emoji: "🎃", base: "haunted-town", music: "phonk", dress: "arena",
    blurb: "Foggy cobbles, pumpkins and spooky lights. Slide past the graveyard.",
    track: { width: 14.5, curviness: 0.64, hills: 0.3, size: 0.95 }, hazards: ["fire", "oil"] },
  { id: "dk-volcano-slide", name: "Volcano Slide", emoji: "🌋", base: "volcano", music: "eurobeat", dress: "arena",
    blurb: "Black basalt and rivers of lava. The heat makes every drift glow.",
    track: { width: 14, curviness: 0.66, hills: 0.55, size: 1.0 }, hazards: ["fire", "rock"], barrier: { kind: "tires", color: "#2A2A2E" } },
  { id: "dk-fjord-ice", name: "Fjord Ice Rally", emoji: "⛵", base: "viking-fjords", music: "phonk", dress: "rally",
    blurb: "A frozen fjord road under steep cliffs. Studded tyres recommended!",
    track: { width: 14, curviness: 0.62, hills: 0.7, size: 1.05 }, hazards: ["rock", "puddle"],
    road: { kind: "snow", color: "#AEB8C4", line: "#FFFFFF", edge: "#E8504F", centre: "none" }, curbs: "none", barrier: { kind: "snowbank", color: "#DDE6F0" } },
  { id: "dk-glacier-drift", name: "Glacier Drift", emoji: "🧊", base: "ice-glacier", music: "eurobeat", dress: "rally",
    blurb: "Blue ice caves and glassy roads. The slipperiest venue in the championship.",
    track: { width: 15, curviness: 0.6, hills: 0.5, size: 1.0 }, hazards: ["puddle", "rock"] },
  { id: "dk-candy-drift", name: "Candy Drift", emoji: "🍭", base: "candy-land", music: "eurobeat", dress: "arena",
    blurb: "Sugar-glazed roads between lollipops. Sweet, sticky, sideways.",
    track: { width: 15, curviness: 0.62, hills: 0.4, size: 0.95 }, hazards: ["oil", "cones"] },
  { id: "dk-mushroom-mtn", name: "Mushroom Mountain", emoji: "🍄", base: "mushroom-forest", music: "eurobeat", dress: "touge",
    blurb: "Glowing giant mushrooms line a twisty cobbled pass.",
    track: { width: 14, curviness: 0.68, hills: 0.55, size: 1.0 }, hazards: ["puddle", "rock"] },
  { id: "dk-cyber-grid", name: "Cyber Drift Grid", emoji: "💠", base: "cyber-grid", music: "phonk", dress: "arena",
    blurb: "A glowing digital arena where your tyre smoke turns to pixels.",
    track: { width: 15.5, curviness: 0.68, hills: 0.3, size: 0.95 }, hazards: ["spikes", "cones"] },
  { id: "dk-aurora-rally", name: "Aurora Night Rally", emoji: "🌌", base: "arctic-aurora", music: "phonk", dress: "rally",
    blurb: "A night snow stage under dancing northern lights.",
    track: { width: 14, curviness: 0.64, hills: 0.55, size: 1.05 }, hazards: ["rock", "puddle"] },
  { id: "dk-moon-drift", name: "Moon Drift", emoji: "🌙", base: "moon-base", music: "eurobeat", dress: "arena",
    blurb: "Low gravity, long floaty slides and craters on every side.",
    track: { width: 15.5, curviness: 0.64, hills: 0.4, size: 1.0 }, hazards: ["rock", "cones"] },
  { id: "dk-mars-rally", name: "Mars Rally", emoji: "🔴", base: "mars-red-planet", music: "phonk", dress: "rally",
    blurb: "A rust-red rally stage on another planet. Dust devils included.",
    track: { width: 14.5, curviness: 0.66, hills: 0.6, size: 1.1 }, hazards: ["rock", "spikes"] },
  { id: "dk-coral-tunnel", name: "Coral Tunnel Drift", emoji: "🐠", base: "coral-dome", music: "eurobeat", dress: "arena",
    blurb: "Glass tubes under the sea. Drift past sharks and shipwrecks.",
    track: { width: 14.5, curviness: 0.66, hills: 0.45, size: 1.0 }, hazards: ["puddle", "rock"] },
  { id: "dk-kings-final", name: "Kings Final", emoji: "👑", base: "rainbow-sky-road", music: "eurobeat", dress: "arena", accent: "#FFD25A",
    blurb: "The championship final on a rainbow road in the sky. Become the Drift King!",
    track: { width: 14.5, curviness: 0.72, hills: 0.8, size: 1.05 }, hazards: ["oil", "cones"] },
];

function venue(v: VDef, order: number): ThemeSpec {
  const b = THEMES.find((t) => t.id === v.base);
  if (!b) throw new Error(`drift venue base missing: ${v.base}`);
  const night = v.night ?? b.night;
  // a venue that changes the time of day bakes the night (or day) look in, so the builder sees a native night world
  const baseLook = night !== b.night ? resolveLook(b, night, b.weather) : (b.look as unknown as ThemeLook);
  const dress = v.dress === "arena" ? ARENA : v.dress === "rally" ? RALLY : v.dress === "touge" ? TOUGE : [];
  const look: ThemeLook = {
    ...baseLook,
    road: { ...baseLook.road, ...(v.road ?? {}) },
    barrier: v.barrier ?? baseLook.barrier,
    curbs: v.curbs ?? (v.dress === "arena" ? "full" : baseLook.curbs),
    props: [...baseLook.props, ...dress, ...(v.props ?? [])],
  };
  return {
    id: v.id, name: v.name, emoji: v.emoji, blurb: v.blurb, order,
    night, weather: v.weather ?? b.weather, music: v.music, accent: v.accent ?? b.accent,
    track: v.track, hazards: v.hazards ?? b.hazards,
    look: look as unknown as Record<string, unknown>,
  };
}

export const DRIFT_THEMES: ThemeSpec[] = V.map((v, i) => venue(v, i));
/** rally venues run on loose surfaces — their middle career event is a Rally Stage */
export const isRallyVenue = (t: ThemeSpec) => {
  const k = (t.look as unknown as ThemeLook).road?.kind;
  return k === "dirt" || k === "sand" || k === "snow" || k === "ice" || k === "regolith";
};
