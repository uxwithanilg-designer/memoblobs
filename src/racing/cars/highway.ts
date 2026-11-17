// The Highway Heat garage: 32 highway machines — street coupes, muscle cars, sleepers, police interceptors, a big
// rig and exotics with heat liveries — plus the civilian traffic list and the police car the cops drive.
// Bodies reuse the Nitro Rush silhouettes with their own trim (chrome, side pipes, scoops, light bars), liveries,
// paint and engine voices. The first three are free; the rest unlock with Highway Heat career stars.
import type { CarSpec, CarStats, EngineVoice } from "../types";
import type { CarShape } from "./shape";
import { CARS } from "./specs";

type Over = Partial<CarShape>;
const baseOf = (id: string) => {
  const c = CARS.find((x) => x.id === id);
  if (!c) throw new Error(`highway base car missing: ${id}`);
  return c.model as unknown as CarShape;
};
const st = (speed: number, accel: number, handling: number, nitro: number, mass = 1.15): CarStats => ({ speed, accel, handling, nitro, mass });
const eng = (tone: EngineVoice["tone"], redline: number, gears = 6, idle = 850): EngineVoice => ({ idle, redline, gears, tone });

interface Def { id: string; name: string; cls: string; tier: CarSpec["tier"]; stars: number; desc: string; stats: CarStats; colors: string[]; engine: EngineVoice; base: string; shape: Over; lower?: number }
const D: Def[] = [
  // ------------------------------------------------------------------ tier 1 — free starters first
  { id: "hh-street-hawk", name: "Street Hawk", cls: "Street Coupe", tier: 1, stars: 0, base: "street-fox",
    desc: "A quick little coupe with racing stripes. Perfect for slipping through traffic.",
    stats: st(5, 5, 6, 4, 1.05), colors: ["#FF7A1A", "#F4F1E6", "#1F2937", "#2A6BFF"], engine: eng("v6", 7600),
    shape: { livery: ["stripes"], stripe: "#1F2937", rims: "split", spoiler: "lip" } },
  { id: "hh-cruiser", name: "Highway Cruiser", cls: "Sleeper Sedan", tier: 1, stars: 0, base: "metro-sedan",
    desc: "Looks like a family sedan. Hides a big engine. The cops never suspect it.",
    stats: st(5, 4, 5, 5, 1.2), colors: ["#C9CDD3", "#1F2937", "#7A1F2B", "#2F6E5A"], engine: eng("v8", 6800, 6, 750),
    shape: { rims: "classic", exhaust: "dual" } },
  { id: "hh-blaze-hatch", name: "Blaze Hatch", cls: "Hot Hatch", tier: 1, stars: 0, base: "pocket-rocket",
    desc: "Small, nimble and loud. Darts between buses like a pinball.",
    stats: st(4, 6, 7, 4, 0.95), colors: ["#FFC600", "#E8504F", "#F4F1E6", "#1F6F4A"], engine: eng("small", 7800, 5, 950),
    shape: { livery: ["number"], number: 66, rims: "spoke5", rimColor: "#1F2937" } },
  { id: "hh-taxi-turbo", name: "Turbo Cab", cls: "Hot Taxi", tier: 1, stars: 5, base: "yellow-dash",
    desc: "The fastest fare in the city. Meter's running — so are the cops.",
    stats: st(5, 5, 5, 5, 1.15), colors: ["#FFC600", "#1F2937", "#F4F1E6"], engine: eng("v6", 7200, 5),
    shape: { rims: "steel" } },
  { id: "hh-mini-bandit", name: "Mini Bandit", cls: "City Car", tier: 1, stars: 10, base: "momo-mini",
    desc: "Tiny, cheeky and impossible to catch in a traffic jam.",
    stats: st(3, 6, 8, 4, 0.9), colors: ["#2A6BFF", "#FF7A1A", "#F4F1E6", "#FF4FD8"], engine: eng("small", 7200, 5, 950),
    shape: { livery: ["stripes"], spoiler: "roof" } },
  { id: "hh-hauler", name: "Desert Hauler", cls: "Pickup", tier: 1, stars: 15, base: "big-bruno",
    desc: "A lifted pickup with a bull bar. Pushes traffic out of the way.",
    stats: st(5, 4, 4, 5, 1.7), colors: ["#E8504F", "#C9CDD3", "#1F2937", "#FFC600"], engine: eng("v8", 6000, 5, 700),
    shape: { extras: ["bullbar", "lightbar"], tyre: "offroad" } },
  // ------------------------------------------------------------------ tier 2
  { id: "hh-canyon-muscle", name: "Canyon Muscle", cls: "Muscle Car", tier: 2, stars: 21, base: "thunder-v8",
    desc: "Side pipes, a hood scoop and a V8 that rattles the windows of every car it passes.",
    stats: st(7, 6, 4, 5, 1.35), colors: ["#C2152B", "#1F2937", "#FFC600", "#F4F1E6"], engine: eng("v8", 6600, 5, 700),
    shape: { extras: ["scoop", "sidepipes"], livery: ["stripes"], stripe: "#F4F1E6", rims: "classic", rimColor: "#D8D8D8" } },
  { id: "hh-night-runner", name: "Night Runner", cls: "Street Racer", tier: 2, stars: 27, base: "drift-ronin",
    desc: "Black paint, purple underglow vibes and pop-up lights. Lives on the night freeway.",
    stats: st(6, 6, 6, 5, 1.0), colors: ["#1F2937", "#6D28D9", "#F4F1E6"], engine: eng("rotary", 8600, 6, 1000),
    shape: { spoiler: "wing", rims: "mesh", rimColor: "#B98CFF", livery: ["side"] } },
  { id: "hh-sunset-gt", name: "Sunset GT", cls: "Grand Tourer", tier: 2, stars: 33, base: "velvet-gt",
    desc: "A long, low cruiser for coast highways. Silky smooth at 250 km/h.",
    stats: st(7, 5, 6, 5, 1.25), colors: ["#FF7A1A", "#FFC600", "#F4F1E6", "#1F2937"], engine: eng("v8", 7000, 6, 750),
    shape: { livery: ["twotone"], rims: "spoke5", rimColor: "#C9A44A", finish: "metal" } },
  { id: "hh-interceptor", name: "Interceptor", cls: "Police Interceptor", tier: 2, stars: 39, base: "blue-siren",
    desc: "The highway patrol's pursuit car. Drive it yourself — or try to outrun one.",
    stats: st(7, 6, 6, 6, 1.3), colors: ["#1F2937", "#F4F1E6"], engine: eng("v8", 7000, 6, 750),
    shape: {} },
  { id: "hh-van-man", name: "Van Man", cls: "Delivery Van", tier: 2, stars: 45, base: "cargo-kong",
    desc: "Late with a parcel and in a hurry. Heavy, but it shoves anything out of the lane.",
    stats: st(5, 4, 4, 5, 2.0), colors: ["#F4F1E6", "#FF7A1A", "#2A6BFF"], engine: eng("diesel", 5200, 6, 700),
    shape: {} },
  { id: "hh-rally-raider", name: "Rally Raider", cls: "Rally Sedan", tier: 2, stars: 51, base: "gravel-ghost",
    desc: "All-wheel drive grip and a light pod. Fearless on wet highways.",
    stats: st(6, 7, 7, 5, 1.1), colors: ["#2A6BFF", "#F4F1E6", "#FFC600"], engine: eng("small", 7800, 6, 900),
    shape: { livery: ["rally", "number"], number: 9 } },
  // ------------------------------------------------------------------ tier 3
  { id: "hh-red-comet", name: "Red Comet", cls: "Sports Car", tier: 3, stars: 58, base: "neon-wedge",
    desc: "An 80s wedge with flip-up lights. Turns heads — and police radars.",
    stats: st(7, 7, 6, 6, 1.05), colors: ["#C2152B", "#F4F1E6", "#1F2937"], engine: eng("v6", 8000),
    shape: { livery: ["side"], rims: "turbine" } },
  { id: "hh-heatwave", name: "Heatwave V8", cls: "Pro Muscle", tier: 3, stars: 65, base: "thunder-v8",
    desc: "Flames down the sides, chrome bumpers and the loudest horn on the highway.",
    stats: st(8, 7, 5, 6, 1.35), colors: ["#1F2937", "#FF7A1A", "#C2152B"], engine: eng("v8", 7000, 6, 700),
    shape: { livery: ["flames"], extras: ["scoop", "sidepipes", "chromebumpers"], rims: "turbine", rimColor: "#D8D8D8" } },
  { id: "hh-big-rig", name: "Big Rig", cls: "Semi Truck", tier: 3, stars: 72, base: "road-king",
    desc: "The king of the interstate. Nothing stops it — not even a roadblock.",
    stats: st(6, 4, 3, 5, 2.6), colors: ["#C2152B", "#1F2937", "#2A6BFF", "#F4F1E6"], engine: eng("diesel", 4400, 6, 600),
    shape: {} },
  { id: "hh-pursuit-gt", name: "Pursuit GT", cls: "High-Speed Police", tier: 3, stars: 79, base: "velvet-gt",
    desc: "The highway patrol's fastest car, with a full light bar.",
    stats: st(8, 7, 6, 6, 1.25), colors: ["#F4F1E6", "#1F2937"], engine: eng("v8", 7600, 6, 750),
    shape: { livery: ["police"], extras: ["lightbar", "pushbar"], rims: "steel" } },
  { id: "hh-wagon-bandit", name: "Wagon Bandit", cls: "Fast Wagon", tier: 3, stars: 86, base: "metro-sedan",
    desc: "A tuned estate with a roof rack. Grandma's car, getaway edition.",
    stats: st(7, 6, 6, 6, 1.2), colors: ["#1F6F4A", "#C9CDD3", "#1F2937"], engine: eng("v8", 7200, 6, 800),
    shape: { extras: ["rack"], livery: ["stripes"], rims: "turbine" } },
  { id: "hh-limo", name: "Getaway Limo", cls: "Stretch Limo", tier: 3, stars: 93, base: "royal-stretch",
    desc: "The VIP getaway. Long, heavy, surprisingly fast.",
    stats: st(7, 5, 4, 6, 1.8), colors: ["#1F2937", "#F4F1E6"], engine: eng("v12", 6600, 6, 700),
    shape: {} },
  { id: "hh-icecream", name: "Ice-Cream Getaway", cls: "Ice-Cream Van", tier: 3, stars: 96, base: "scoop-truck",
    desc: "The chimes play, the cones wobble — and it outruns police cars. Nobody knows how.",
    stats: st(6, 5, 4, 6, 1.6), colors: ["#B9FBC0", "#FF9CEE", "#7BDFF2"], engine: eng("diesel", 5200, 5, 700),
    shape: {} },
  { id: "hh-bus", name: "Freeway Bus", cls: "City Bus", tier: 3, stars: 100, base: "big-yellow",
    desc: "Next stop: 220 km/h. The passengers are loving it.",
    stats: st(6, 4, 3, 6, 2.4), colors: ["#FFC600", "#E8504F", "#2A6BFF"], engine: eng("diesel", 4600, 6, 600),
    shape: {} },
  // ------------------------------------------------------------------ tier 4
  { id: "hh-midnight-stallion", name: "Midnight Stallion", cls: "Supercar", tier: 4, stars: 110, base: "zoom-x",
    desc: "A black supercar built for long night runs on empty freeways.",
    stats: st(9, 8, 6, 7, 1.15), colors: ["#1F2937", "#C2152B", "#FFC600"], engine: eng("v12", 8800, 7, 1000),
    shape: { rims: "y6", rimColor: "#C2152B", livery: ["stripes"] } },
  { id: "hh-chrome-bandit", name: "Chrome Bandit", cls: "Luxury GT", tier: 4, stars: 120, base: "inferno-v12",
    desc: "Mirror-chrome paint. You can see the police lights in it from a mile away.",
    stats: st(9, 7, 7, 7, 1.2), colors: ["#C9CDD3", "#FFC600", "#1F2937"], engine: eng("v12", 8600, 7, 1000),
    shape: { finish: "metal", rims: "split", rimColor: "#1F2937" } },
  { id: "hh-thunder-cop", name: "Thunder Cop", cls: "Super Interceptor", tier: 4, stars: 130, base: "track-shark",
    desc: "A race car in police colours. Built to end any chase.",
    stats: st(9, 8, 7, 7, 1.15), colors: ["#1F2937", "#2A6BFF", "#F4F1E6"], engine: eng("v8", 8400, 6, 900),
    shape: { livery: ["police"], extras: ["lightbar"] } },
  { id: "hh-vapor", name: "Vapor Wave", cls: "Electric GT", tier: 4, stars: 140, base: "volt-phantom",
    desc: "Silent, instant and very, very quick. The cops can't hear it coming.",
    stats: st(9, 9, 7, 7, 1.15), colors: ["#7CF2FF", "#FF4FD8", "#F4F1E6"], engine: eng("electric", 16000, 1, 0),
    shape: { rims: "aero", rimColor: "#FF4FD8" } },
  { id: "hh-firestorm", name: "Firestorm", cls: "Hypercar", tier: 4, stars: 150, base: "night-comet",
    desc: "A prototype that leaves heat shimmer on the tarmac.",
    stats: st(9, 8, 8, 7, 1.0), colors: ["#FF7A1A", "#1F2937", "#C2152B"], engine: eng("v6", 9200, 7, 1100),
    shape: { livery: ["flames"] } },
  { id: "hh-autobahn", name: "Autobahn GT", cls: "Grand Tourer", tier: 4, stars: 160, base: "street-fox",
    desc: "Born on roads with no speed limit. Stable as a rock at top speed.",
    stats: st(9, 7, 8, 7, 1.1), colors: ["#C9CDD3", "#1F2937", "#2A6BFF"], engine: eng("v8", 8400, 7, 850),
    shape: { spoiler: "duck", rims: "y6", finish: "metal", flare: 0.06 } },
  // ------------------------------------------------------------------ tier 5
  { id: "hh-inferno", name: "Inferno Heat", cls: "Hypercar", tier: 5, stars: 172, base: "inferno-v12",
    desc: "The hottest car on the highway, wrapped in flames.",
    stats: st(10, 9, 7, 8, 1.2), colors: ["#C2152B", "#FF7A1A", "#1F2937"], engine: eng("v12", 9200, 7, 1000),
    shape: { livery: ["flames"], rims: "y6", rimColor: "#FFC600" } },
  { id: "hh-phantom-cop", name: "Phantom Cop", cls: "Electric Interceptor", tier: 5, stars: 185, base: "volt-phantom",
    desc: "The future of the highway patrol: silent, electric and unstoppable.",
    stats: st(10, 10, 8, 8, 1.15), colors: ["#F4F1E6", "#1F2937"], engine: eng("electric", 17000, 1, 0),
    shape: { livery: ["police"], extras: ["lightbar"] } },
  { id: "hh-nebula", name: "Nebula Run", cls: "Concept Car", tier: 5, stars: 198, base: "nebula-x",
    desc: "A concept car that looks like it came from 2099. Fast enough to match.",
    stats: st(10, 9, 8, 8, 1.05), colors: ["#B9FBC0", "#7CF2FF", "#FF9CEE"], engine: eng("electric", 15000, 1, 0),
    shape: {} },
  { id: "hh-thunderbolt", name: "Momo Thunderbolt H", cls: "Ultimate Hypercar", tier: 5, stars: 212, base: "momo-thunderbolt",
    desc: "Momo's hypercar in highway trim. Outruns anything with a siren.",
    stats: st(10, 10, 9, 9, 1.15), colors: ["#FF7A1A", "#2A6BFF", "#F4F1E6"], engine: eng("v12", 9400, 7, 1000),
    shape: { livery: ["stripes"] } },
  { id: "hh-apex", name: "Apex Street", cls: "Road-Legal Racer", tier: 5, stars: 226, base: "apex-f",
    desc: "A formula car with number plates. Ridiculous. Brilliant.",
    stats: st(10, 10, 10, 8, 0.8), colors: ["#C2152B", "#FFC600", "#2A6BFF"], engine: eng("v12", 13000, 7, 1200),
    shape: {} },
  { id: "hh-heat-king", name: "The Heat King", cls: "Champion's Car", tier: 5, stars: 250, base: "zoom-x",
    desc: "Golden flames on black. Only the most wanted driver in the land gets these keys.",
    stats: st(10, 10, 9, 10, 1.1), colors: ["#1F2937", "#FFC600"], engine: eng("v12", 9800, 7, 1000),
    shape: { livery: ["flames"], rims: "mesh", rimColor: "#FFC600", spoiler: "gt", finish: "metal" } },
];

export const HIGHWAY_CARS: CarSpec[] = D.map((d) => {
  const b = baseOf(d.base);
  const m: CarShape = { ...b, hgt: b.hgt * (d.lower ?? 1), ...d.shape };
  return { id: d.id, name: d.name, cls: d.cls, tier: d.tier, unlockStars: d.stars, desc: d.desc, stats: d.stats, colors: d.colors, engine: d.engine, model: m as unknown as Record<string, unknown> };
});

/** the police car the cops drive (and the roadblocks) */
export const HIGHWAY_COP_CAR = "hh-pursuit-gt";
/** civilian traffic (Nitro Rush bodies in everyday colours) */
export const HIGHWAY_TRAFFIC = ["metro-sedan", "yellow-dash", "momo-mini", "bubble-buzz", "cargo-kong", "big-yellow", "road-king", "big-bruno", "trail-boss", "scoop-truck", "royal-stretch", "street-fox", "rally-hopper"];
