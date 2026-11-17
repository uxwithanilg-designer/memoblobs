// The Drift Kings garage: 33 drift & rally machines. Bodies reuse the lofted silhouettes of the Nitro Rush cars,
// then get their own drift build — lower ride, negative camber, wider arches, wings, liveries, wheels, paint and
// engine voice — and a `drift` stat (how far and how easily the car slides). The first three are free; the rest
// unlock with Drift Kings career stars (26+ venues × 4 events × 3 stars = 300+).
import type { CarSpec, CarStats, EngineVoice } from "../types";
import type { CarShape } from "./shape";
import { CARS } from "./specs";

type Over = Partial<CarShape> & { lower?: number; widen?: number };
const baseOf = (id: string) => {
  const c = CARS.find((x) => x.id === id);
  if (!c) throw new Error(`drift base car missing: ${id}`);
  return c.model as unknown as CarShape;
};
function build(baseId: string, o: Over): Record<string, unknown> {
  const b = baseOf(baseId);
  const { lower = 0.97, widen = 1.03, ...rest } = o;
  const m: CarShape = { ...b, hgt: b.hgt * lower, wid: b.wid * widen, ...rest };
  return m as unknown as Record<string, unknown>;
}
const st = (speed: number, accel: number, handling: number, nitro: number, drift: number, mass = 1.1): CarStats => ({ speed, accel, handling, nitro, drift, mass });
const eng = (tone: EngineVoice["tone"], redline: number, gears = 6, idle = 900): EngineVoice => ({ idle, redline, gears, tone });

interface Def { id: string; name: string; cls: string; tier: CarSpec["tier"]; stars: number; desc: string; stats: CarStats; colors: string[]; engine: EngineVoice; base: string; shape: Over; /** ride height / body width scale (default 0.97 / 1.03) */ lower?: number; widen?: number }
const D: Def[] = [
  // ------------------------------------------------------------------ tier 1 — the three free starters first
  { id: "dk-sakura-86", name: "Sakura 86", cls: "Drift Coupe", tier: 1, stars: 0, base: "drift-ronin",
    desc: "The classic panda-paint drift coupe. Light, balanced and happy to slide all day.",
    stats: st(4, 4, 6, 3, 7, 0.95), colors: ["#F4F1E6", "#1F2937", "#E8504F", "#FFD25A", "#2E86C8"], engine: eng("small", 7600, 5),
    shape: { livery: ["twotone"], camber: 0.035, spoiler: "duck", rims: "mesh", rimColor: "#D8D8D8", flare: 0.04, exhaust: "single" } },
  { id: "dk-momo-street", name: "Momo Street", cls: "Street Coupe", tier: 1, stars: 0, base: "street-fox",
    desc: "A lowered street coupe with a cheeky duck-tail. Your first taste of sideways.",
    stats: st(5, 4, 5, 3, 6, 1.05), colors: ["#FF6F91", "#7CF2FF", "#1F2937", "#FFD25A", "#9B5DE5"], engine: eng("v6", 7400),
    shape: { spoiler: "duck", camber: 0.04, rims: "y6", rimColor: "#1F2937", livery: ["side"], flare: 0.05 } },
  { id: "dk-gravel-pup", name: "Gravel Pup", cls: "Rally Hatch", tier: 1, stars: 0, base: "rally-hopper", lower: 1.02, widen: 1.0,
    desc: "Mud flaps, light pod and a big grin. Built for dirt, snow and gravel rally stages.",
    stats: st(4, 5, 7, 3, 6, 1.0), colors: ["#74C94E", "#2E86C8", "#F4F1E6", "#FF8A3D"], engine: eng("rotary", 7800, 5, 950),
    shape: { livery: ["rally", "number"], number: 21, rims: "dish", rimColor: "#F4F1E6", tyre: "offroad" } },
  { id: "dk-kei-kaze", name: "Kei Kaze", cls: "Kei Drifter", tier: 1, stars: 5, base: "bubble-buzz",
    desc: "A tiny kei car with a tiny wing and huge attitude. Spins up instantly.",
    stats: st(3, 6, 7, 3, 8, 0.8), colors: ["#B9FBC0", "#FF9CEE", "#7BDFF2", "#FFD25A"], engine: eng("small", 8200, 5, 1100),
    shape: { spoiler: "wing", camber: 0.06, rims: "star", rimColor: "#FFD25A", flare: 0.05, livery: ["number"], number: 3 } },
  { id: "dk-slide-kart", name: "Slide Kart", cls: "Drift Kart", tier: 1, stars: 10, base: "zippy-kart", lower: 1, widen: 1,
    desc: "A go-kart on slippery hard tyres. Pure, giggly, sideways fun.",
    stats: st(3, 7, 8, 3, 9, 0.7), colors: ["#FFD25A", "#FF4FD8", "#2EC4B6", "#E8504F"], engine: eng("kart", 11000, 4, 1600),
    shape: { seat: "#1F2937", accent: "#FF4FD8" } },
  { id: "dk-metro-wagon", name: "Metro Slider", cls: "Drift Sedan", tier: 1, stars: 15, base: "metro-sedan",
    desc: "Grandpa's sedan with a welded diff. Nobody expects it to go sideways this well.",
    stats: st(5, 4, 5, 4, 7, 1.2), colors: ["#C9CDD3", "#5B7DB1", "#7A1F2B", "#2F6E5A"], engine: eng("v6", 7000),
    shape: { camber: 0.04, spoiler: "lip", rims: "classic", rimColor: "#D8D8D8", flare: 0.03 } },
  // ------------------------------------------------------------------ tier 2
  { id: "dk-bug-slider", name: "Bug Slider", cls: "Classic Rally Bug", tier: 2, stars: 21, base: "bugsy-classic",
    desc: "A round little classic with rally lamps and stubby flares. Loves loose gravel.",
    stats: st(4, 5, 6, 3, 7, 0.9), colors: ["#FF8A3D", "#7BDFF2", "#F4F1E6", "#E8504F"], engine: eng("small", 6800, 4, 850),
    shape: { extras: ["lightpod", "mudflaps"], livery: ["number", "stripes"], number: 53, rims: "steel", flare: 0.05, tyre: "offroad" } },
  { id: "dk-pocket-drift", name: "Pocket Drift", cls: "Hot Hatch", tier: 2, stars: 27, base: "pocket-rocket",
    desc: "A hot hatch with a giant wing and a handbrake that never rests.",
    stats: st(5, 6, 6, 4, 7, 1.0), colors: ["#E8504F", "#F4F1E6", "#3B82F6", "#FFD25A"], engine: eng("small", 8000, 6, 950),
    shape: { spoiler: "wing", camber: 0.05, rims: "split", rimColor: "#FFD25A", livery: ["stripes"], flare: 0.06 } },
  { id: "dk-smoke-bull", name: "Smoke Bull", cls: "Muscle Drifter", tier: 2, stars: 33, base: "thunder-v8",
    desc: "Big V8, big smoke, big grin. Burnouts are its love language.",
    stats: st(6, 6, 4, 4, 8, 1.35), colors: ["#1F2937", "#FFD25A", "#E8504F", "#2E86C8"], engine: eng("v8", 6600, 5, 750),
    shape: { livery: ["stripes"], stripe: "#FFD25A", camber: 0.03, rims: "turbine", flare: 0.06, extras: ["hoodvents", "intake"] } },
  { id: "dk-tokyo-taxi", name: "Tokyo Taxi", cls: "Drift Taxi", tier: 2, stars: 39, base: "yellow-dash",
    desc: "The night-shift taxi that takes every corner sideways. Hold on to your hat!",
    stats: st(5, 5, 5, 4, 8, 1.15), colors: ["#FFD25A", "#1F2937", "#2E6E5A", "#F4F1E6"], engine: eng("v6", 7000, 5),
    shape: { livery: ["checker"], camber: 0.05, rims: "steel", spoiler: "duck", flare: 0.04 } },
  { id: "dk-drift-ute", name: "Drift Ute", cls: "Pickup Drifter", tier: 2, stars: 45, base: "big-bruno", lower: 0.9, widen: 1.02,
    desc: "A slammed pickup with a stack exhaust. The bed fills with tyre smoke.",
    stats: st(5, 5, 4, 4, 7, 1.55), colors: ["#2E86C8", "#F4F1E6", "#74C94E", "#E8504F"], engine: eng("v8", 6200, 5, 700),
    shape: { camber: 0.03, rims: "spoke5", tyre: "road", flare: 0.05, extras: ["sidepipes"] } },
  { id: "dk-raid-runner", name: "Raid Runner", cls: "Rally Raid 4x4", tier: 2, stars: 51, base: "trail-boss", lower: 1.0, widen: 1.02,
    desc: "A desert-raid SUV with a roof rack, snorkel and long-travel springs.",
    stats: st(5, 5, 5, 4, 5, 1.6), colors: ["#F4F1E6", "#FF8A3D", "#1F2937", "#74C94E"], engine: eng("diesel", 5200, 6, 700),
    shape: { livery: ["rally", "number"], number: 404, extras: ["snorkel", "rack", "lightbar", "mudflaps"], tyre: "offroad", rims: "offroad" } },
  { id: "dk-sand-viper", name: "Sand Viper", cls: "Rally Buggy", tier: 2, stars: 57, base: "dune-rattler", lower: 1, widen: 1,
    desc: "An open buggy with paddle tyres. Throws sand rooster-tails through every bend.",
    stats: st(5, 7, 6, 4, 8, 0.85), colors: ["#74C94E", "#FFD25A", "#FF4FD8", "#2E86C8"], engine: eng("small", 7400, 5, 1000),
    shape: {} },
  // ------------------------------------------------------------------ tier 3
  { id: "dk-ronin-s", name: "Ronin S", cls: "Widebody Drift Coupe", tier: 3, stars: 64, base: "drift-ronin", widen: 1.07,
    desc: "The 86's big brother: bolted-on arches, a huge GT wing and a screaming four.",
    stats: st(6, 6, 6, 5, 8, 1.0), colors: ["#1F2937", "#FF4FD8", "#F4F1E6", "#FFD25A"], engine: eng("small", 8800, 6, 1000),
    shape: { spoiler: "gt", camber: 0.06, rims: "mesh", rimColor: "#FFD25A", flare: 0.1, livery: ["side", "number"], number: 86, extras: ["hoodvents", "towhook"] } },
  { id: "dk-gravel-king", name: "Gravel King", cls: "Rally Legend", tier: 3, stars: 71, base: "gravel-ghost", lower: 1.0,
    desc: "A four-wheel-drive rally legend. Flat out on gravel, brave on snow.",
    stats: st(6, 6, 7, 4, 6, 1.1), colors: ["#2E86C8", "#F4F1E6", "#E8504F", "#FFD25A"], engine: eng("small", 7600, 6, 900),
    shape: { livery: ["rally", "number"], number: 1, tyre: "offroad", rims: "dish", rimColor: "#FFD25A", extras: ["lightpod", "mudflaps", "roofscoop"] } },
  { id: "dk-retro-wedge", name: "Retro Wedge", cls: "80s Drift Wedge", tier: 3, stars: 78, base: "neon-wedge",
    desc: "Pop-up lamps, louvres and a mid-engine snap. Drift it like it's 1987.",
    stats: st(6, 6, 6, 5, 7, 1.05), colors: ["#F4F1E6", "#E8504F", "#1F2937", "#7CF2FF"], engine: eng("v6", 7800),
    shape: { camber: 0.04, rims: "turbine", flare: 0.06, livery: ["side"] } },
  { id: "dk-siren-slide", name: "Siren Slide", cls: "Pursuit Drifter", tier: 3, stars: 85, base: "blue-siren",
    desc: "A retired police interceptor that only chases corners now.",
    stats: st(6, 5, 5, 5, 7, 1.3), colors: ["#1F2937", "#F4F1E6", "#2E86C8"], engine: eng("v8", 6800, 6, 750),
    shape: { camber: 0.03, rims: "steel", flare: 0.04 } },
  { id: "dk-velvet-drift", name: "Velvet Drift", cls: "Drift GT", tier: 3, stars: 92, base: "velvet-gt",
    desc: "A long-bonnet grand tourer with silky slides and a deep V8 rumble.",
    stats: st(7, 5, 6, 5, 7, 1.25), colors: ["#7A1F2B", "#1F2937", "#C9CDD3", "#2F6E5A"], engine: eng("v8", 7200, 6, 750),
    shape: { camber: 0.04, spoiler: "duck", rims: "split", rimColor: "#C9A44A", flare: 0.06, finish: "metal" } },
  { id: "dk-mud-monster", name: "Mud Monster", cls: "Monster Truck", tier: 3, stars: 99, base: "crusher", lower: 1, widen: 1,
    desc: "Why not drift a monster truck? Huge tyres, huge slides, huge laughs.",
    stats: st(5, 6, 4, 4, 6, 2.3), colors: ["#74C94E", "#FF8A3D", "#9B5DE5", "#1F2937"], engine: eng("v8", 5600, 5, 650),
    shape: { livery: ["flames"] } },
  { id: "dk-slide-limo", name: "Slide Limo", cls: "Drift Limousine", tier: 3, stars: 106, base: "royal-stretch",
    desc: "The longest drift you will ever do. The passengers are screaming (happily).",
    stats: st(6, 4, 4, 5, 9, 1.7), colors: ["#F4F1E6", "#1F2937", "#FF9CEE"], engine: eng("v12", 6500, 6, 700),
    shape: { camber: 0.03, rims: "spoke5", rimColor: "#C9A44A" } },
  // ------------------------------------------------------------------ tier 4
  { id: "dk-zoom-drift", name: "Zoom Drift", cls: "Drift Supercar", tier: 4, stars: 114, base: "zoom-x",
    desc: "A supercar set up for big angle: steering lock for days and a smoky V10.",
    stats: st(8, 7, 6, 6, 8, 1.15), colors: ["#74C94E", "#FFD25A", "#1F2937", "#FF4FD8"], engine: eng("v12", 8600, 7, 1000),
    shape: { camber: 0.05, spoiler: "swan", rims: "y6", rimColor: "#1F2937", flare: 0.07, livery: ["number"], number: 10 } },
  { id: "dk-shark-gt", name: "Shark GT Drift", cls: "GT Drift Car", tier: 4, stars: 122, base: "track-shark",
    desc: "A GT race car with its traction control switched firmly OFF.",
    stats: st(8, 7, 7, 6, 7, 1.15), colors: ["#F4F1E6", "#2E86C8", "#E8504F", "#1F2937"], engine: eng("v8", 8200, 6, 900),
    shape: { camber: 0.05, rims: "split", rimColor: "#E8504F", livery: ["side", "number"], number: 24 } },
  { id: "dk-comet-proto", name: "Comet Proto", cls: "Drift Prototype", tier: 4, stars: 130, base: "night-comet",
    desc: "A prototype with a shark fin and a hair-trigger tail. For brave hands only.",
    stats: st(9, 7, 7, 6, 7, 1.0), colors: ["#1F2937", "#7CF2FF", "#FF4FD8"], engine: eng("v6", 9000, 7, 1100),
    shape: { camber: 0.04, livery: ["number"], number: 7 } },
  { id: "dk-fox-r", name: "Fox R Widebody", cls: "Pro Drift Coupe", tier: 4, stars: 139, base: "street-fox", widen: 1.08,
    desc: "Momo Street, grown up: pro-spec widebody, a big wing and a turbo flutter.",
    stats: st(8, 7, 7, 6, 9, 1.05), colors: ["#FF4FD8", "#1F2937", "#7CF2FF", "#F4F1E6"], engine: eng("rotary", 9200, 6, 1100),
    shape: { spoiler: "gt", camber: 0.07, rims: "mesh", rimColor: "#7CF2FF", flare: 0.12, livery: ["side", "number"], number: 99, extras: ["hoodvents", "towhook", "intake"] } },
  { id: "dk-thunder-pro", name: "Thunder Pro", cls: "Pro Muscle Drifter", tier: 4, stars: 148, base: "thunder-v8", widen: 1.06,
    desc: "A pro-drift muscle car: wide tyres, a hood scoop and enough smoke to hide a stadium.",
    stats: st(8, 7, 6, 6, 9, 1.35), colors: ["#E8504F", "#1F2937", "#F4F1E6", "#FFD25A"], engine: eng("v8", 7600, 6, 700),
    shape: { spoiler: "wing", camber: 0.06, rims: "turbine", rimColor: "#1F2937", flare: 0.1, livery: ["flames"], extras: ["scoop", "hoodvents"] } },
  { id: "dk-snow-yeti", name: "Snow Yeti", cls: "Ice Rally Hatch", tier: 4, stars: 157, base: "rally-hopper", lower: 1.02,
    desc: "A winter-spec rally hatch on studded tyres. Grips where everything else slides.",
    stats: st(7, 7, 8, 5, 6, 1.0), colors: ["#F4F1E6", "#7BDFF2", "#E8504F"], engine: eng("rotary", 8600, 6, 1000),
    shape: { livery: ["rally", "number"], number: 11, tyre: "offroad", rims: "dish", rimColor: "#E8504F", extras: ["lightpod", "mudflaps", "roofscoop", "towhook"] } },
  // ------------------------------------------------------------------ tier 5
  { id: "dk-inferno-drift", name: "Inferno Drift", cls: "Drift Hypercar", tier: 5, stars: 168, base: "inferno-v12",
    desc: "A V12 hypercar that leaves a trail of flames and tyre smoke through every bend.",
    stats: st(9, 8, 7, 7, 8, 1.2), colors: ["#E8504F", "#1F2937", "#FFD25A"], engine: eng("v12", 9000, 7, 1000),
    shape: { camber: 0.05, livery: ["flames"], rims: "y6", rimColor: "#FFD25A", flare: 0.07 } },
  { id: "dk-volt-slide", name: "Volt Slide", cls: "Electric Drifter", tier: 5, stars: 180, base: "volt-phantom",
    desc: "Silent, instant torque and perfect balance. It drifts on a whisper.",
    stats: st(9, 9, 7, 7, 8, 1.15), colors: ["#C9CDD3", "#7CF2FF", "#1F2937"], engine: eng("electric", 16000, 1, 0),
    shape: { camber: 0.05, rims: "aero", rimColor: "#7CF2FF", flare: 0.06 } },
  { id: "dk-nebula-drift", name: "Nebula Drift", cls: "Concept Drifter", tier: 5, stars: 192, base: "nebula-x",
    desc: "A concept car from the future, tuned for angle instead of lap times.",
    stats: st(9, 8, 8, 7, 8, 1.05), colors: ["#B9FBC0", "#FF9CEE", "#7CF2FF"], engine: eng("electric", 15000, 1, 0),
    shape: { camber: 0.05, rims: "aero", flare: 0.06 } },
  { id: "dk-rotary-king", name: "Rotary King", cls: "Rotary Drift Legend", tier: 5, stars: 205, base: "drift-ronin", widen: 1.1,
    desc: "A screaming rotary, swan-neck wing and the widest arches in the paddock.",
    stats: st(9, 8, 8, 7, 10, 1.0), colors: ["#FFD25A", "#1F2937", "#FF4FD8", "#F4F1E6"], engine: eng("rotary", 9800, 6, 1100),
    shape: { spoiler: "swan", camber: 0.08, rims: "mesh", rimColor: "#1F2937", flare: 0.14, livery: ["side", "number"], number: 13, extras: ["hoodvents", "towhook", "intake"] } },
  { id: "dk-thunderbolt", name: "Momo Thunderbolt D", cls: "Drift Hypercar", tier: 5, stars: 220, base: "momo-thunderbolt",
    desc: "Momo's hypercar with a drift brain. Points rain down at every angle.",
    stats: st(10, 9, 8, 8, 9, 1.15), colors: ["#FF8A3D", "#7CF2FF", "#F4F1E6"], engine: eng("v12", 9400, 7, 1000),
    shape: { camber: 0.05, flare: 0.07 } },
  { id: "dk-drift-dragon", name: "Drift Dragon", cls: "Ultimate Drift Car", tier: 5, stars: 240, base: "zoom-x", widen: 1.08,
    desc: "Painted with dragon flames and built to win every battle in the final venue.",
    stats: st(10, 9, 9, 8, 10, 1.1), colors: ["#9B5DE5", "#E8504F", "#1F2937"], engine: eng("v12", 9600, 7, 1000),
    shape: { spoiler: "gt", camber: 0.07, rims: "star", rimColor: "#FFD25A", flare: 0.12, livery: ["flames"], extras: ["hoodvents", "intake"] } },
  { id: "dk-drift-king", name: "The Drift King", cls: "Champion's Crown", tier: 5, stars: 265, base: "momo-thunderbolt", widen: 1.06,
    desc: "Gold paint, the biggest wing in the game and the crown of every Drift King. Earn it!",
    stats: st(10, 10, 9, 9, 10, 1.1), colors: ["#FFD25A", "#1F2937", "#F4F1E6"], engine: eng("v12", 9800, 7, 1000),
    shape: { spoiler: "gt", camber: 0.07, rims: "mesh", rimColor: "#1F2937", flare: 0.12, finish: "metal", livery: ["number"], number: 1 } },
];

export const DRIFT_CARS: CarSpec[] = D.map((d) => ({
  id: d.id, name: d.name, cls: d.cls, tier: d.tier, unlockStars: d.stars, desc: d.desc, stats: d.stats, colors: d.colors, engine: d.engine,
  model: build(d.base, { lower: d.lower, widen: d.widen, ...d.shape }),
}));
