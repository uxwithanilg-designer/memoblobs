// The Moto Rush GP garage: 32 motorcycles, each with its own rider colours. First three free, the rest unlock with
// Moto Rush GP career stars. Bodies come from the procedural bike builder (bike.ts) by style.
import type { CarSpec, CarStats, EngineVoice } from "../types";
import type { BikeShape, BikeStyle } from "./bike";

const st = (speed: number, accel: number, handling: number, nitro: number, mass = 0.6): CarStats => ({ speed, accel, handling, nitro, mass });
const eng = (tone: EngineVoice["tone"], redline: number, gears = 6, idle = 1200): EngineVoice => ({ idle, redline, gears, tone });
const GEO: Record<BikeStyle, Pick<BikeShape, "wb" | "wheelR" | "rearW" | "frontW" | "rim">> = {
  sport: { wb: 1.4, wheelR: 0.31, rearW: 0.19, frontW: 0.13, rim: "alloy" },
  electric: { wb: 1.42, wheelR: 0.31, rearW: 0.19, frontW: 0.13, rim: "disc" },
  naked: { wb: 1.42, wheelR: 0.31, rearW: 0.18, frontW: 0.13, rim: "alloy" },
  supermoto: { wb: 1.46, wheelR: 0.3, rearW: 0.16, frontW: 0.12, rim: "spoke" },
  scooter: { wb: 1.3, wheelR: 0.24, rearW: 0.13, frontW: 0.12, rim: "alloy" },
  cruiser: { wb: 1.62, wheelR: 0.33, rearW: 0.22, frontW: 0.15, rim: "spoke" },
  chopper: { wb: 1.78, wheelR: 0.32, rearW: 0.22, frontW: 0.11, rim: "spoke" },
  cafe: { wb: 1.4, wheelR: 0.32, rearW: 0.16, frontW: 0.12, rim: "spoke" },
};
interface Def {
  id: string; name: string; cls: string; tier: CarSpec["tier"]; stars: number; desc: string; stats: CarStats; colors: string[]; engine: EngineVoice;
  style: BikeStyle; accent?: string; livery?: BikeShape["livery"]; suit: [string, string]; helmet: [string, string]; rimColor?: string; metal?: string; exhaust?: BikeShape["exhaust"];
}
const D: Def[] = [
  // ------------------------------------------------------------------ tier 1 — free starters first
  { id: "mr-zippy-125", name: "Zippy 125", cls: "Sport 125", tier: 1, stars: 0, style: "sport", desc: "A light little sport bike that loves to lean. The perfect first race bike.",
    stats: st(4, 5, 7, 4, 0.45), colors: ["#E10600", "#F5F5F7", "#1E4FD8", "#FFD400"], engine: eng("single", 11000, 6, 1500), accent: "#F5F5F7", livery: "stripe", suit: ["#E10600", "#F5F5F7"], helmet: ["#F5F5F7", "#1a1a1a"] },
  { id: "mr-street-naked", name: "Street Naked", cls: "Naked Twin", tier: 1, stars: 0, style: "naked", desc: "No fairings, just a punchy twin and a big grin. Easy to ride, quick out of corners.",
    stats: st(5, 6, 5, 4, 0.55), colors: ["#1E9C4F", "#111214", "#FF7A1A", "#F5F5F7"], engine: eng("twin", 9500, 6, 1100), suit: ["#111214", "#1E9C4F"], helmet: ["#1E9C4F", "#1a1a1a"] },
  { id: "mr-scoot-racer", name: "Scoot Racer", cls: "Racing Scooter", tier: 1, stars: 0, style: "scooter", desc: "A scooter with a race number and a buzzy engine. Ridiculously nimble.",
    stats: st(3, 7, 8, 4, 0.4), colors: ["#FFD400", "#40C4FF", "#FF5FA2", "#F5F5F7"], engine: eng("scooter", 10500, 1, 1800), accent: "#111214", suit: ["#40C4FF", "#FFD400"], helmet: ["#FFD400", "#1a1a1a"] },
  { id: "mr-mud-hopper", name: "Mud Hopper SM", cls: "Supermoto", tier: 1, stars: 5, style: "supermoto", desc: "A dirt bike on road tyres. Brakes late, slides wide, wheelies everywhere.",
    stats: st(4, 7, 7, 4, 0.45), colors: ["#FF7A1A", "#F5F5F7", "#1E4FD8"], engine: eng("single", 10500, 6, 1500), accent: "#F5F5F7", livery: "split", suit: ["#FF7A1A", "#111214"], helmet: ["#FF7A1A", "#F5F5F7"] },
  { id: "mr-cafe-classic", name: "Café Classic", cls: "Café Racer", tier: 1, stars: 10, style: "cafe", desc: "Spoked wheels, a hump seat and clip-on bars. Old school cool.",
    stats: st(5, 5, 6, 4, 0.55), colors: ["#2F6E5A", "#7A1F2B", "#C9CDD3", "#111214"], engine: eng("twin", 8500, 5, 1000), accent: "#F5F5F7", livery: "stripe", suit: ["#5a3a22", "#C9A44A"], helmet: ["#C9CDD3", "#1a1a1a"], rimColor: "#C9CDD3" },
  { id: "mr-lemon-scooter", name: "Lemon Scooter", cls: "City Scooter", tier: 1, stars: 15, style: "scooter", desc: "The fastest pizza delivery in town. Weaves through anything.",
    stats: st(4, 7, 8, 5, 0.42), colors: ["#FFF176", "#B9FBC0", "#FF9CEE"], engine: eng("scooter", 10000, 1, 1800), accent: "#F5F5F7", suit: ["#F5F5F7", "#FFD400"], helmet: ["#B9FBC0", "#1a1a1a"] },
  // ------------------------------------------------------------------ tier 2
  { id: "mr-sprint-400", name: "Sprint 400", cls: "Sport 400", tier: 2, stars: 21, style: "sport", desc: "A screaming little four-cylinder that revs to the moon.",
    stats: st(6, 6, 7, 5, 0.5), colors: ["#1E4FD8", "#F5F5F7", "#FFD400"], engine: eng("inline4", 14500, 6, 1500), accent: "#F5F5F7", livery: "split", suit: ["#1E4FD8", "#F5F5F7"], helmet: ["#1E4FD8", "#FFD400"] },
  { id: "mr-road-cruiser", name: "Road Cruiser", cls: "Cruiser", tier: 2, stars: 27, style: "cruiser", desc: "Low, long and chrome-heavy. Thunders down the straights.",
    stats: st(6, 5, 4, 5, 0.85), colors: ["#111214", "#7A1F2B", "#C9CDD3"], engine: eng("twin", 6200, 5, 800), accent: "#C9CDD3", suit: ["#111214", "#5a3a22"], helmet: ["#111214", "#C9CDD3"], metal: "#E6E8EC", rimColor: "#E6E8EC" },
  { id: "mr-thunder-naked", name: "Thunder Naked", cls: "Naked 700", tier: 2, stars: 33, style: "naked", desc: "A muscle-bound naked bike that wheelies just by looking at it.",
    stats: st(7, 7, 5, 5, 0.6), colors: ["#FF7A1A", "#111214", "#E10600"], engine: eng("inline4", 12500, 6, 1300), suit: ["#111214", "#FF7A1A"], helmet: ["#111214", "#FF7A1A"] },
  { id: "mr-volt-scooter", name: "Volt Scooter", cls: "Electric Scooter", tier: 2, stars: 39, style: "scooter", desc: "Silent and instant. Zero to fun in no time.",
    stats: st(5, 8, 8, 5, 0.42), colors: ["#40C4FF", "#F5F5F7", "#B98CFF"], engine: eng("electric", 14000, 1, 0), accent: "#111214", suit: ["#F5F5F7", "#40C4FF"], helmet: ["#40C4FF", "#1a1a1a"] },
  { id: "mr-sm-pro", name: "Supermoto Pro", cls: "Supermoto", tier: 2, stars: 45, style: "supermoto", desc: "Race-spec supermoto: lighter, sharper, angrier.",
    stats: st(6, 8, 8, 5, 0.45), colors: ["#E10600", "#F5F5F7", "#111214"], engine: eng("single", 11500, 6, 1500), accent: "#111214", livery: "split", suit: ["#E10600", "#111214"], helmet: ["#F5F5F7", "#E10600"] },
  { id: "mr-ton-up", name: "Ton-Up Café", cls: "Café Racer", tier: 2, stars: 51, style: "cafe", desc: "Built for the magic 100 mph. Racing stripes and a bullet fairing.",
    stats: st(7, 6, 6, 5, 0.55), colors: ["#F5F5F7", "#1E4FD8", "#FFD400"], engine: eng("twin", 9000, 5, 1000), accent: "#1E4FD8", livery: "stripe", suit: ["#111214", "#F5F5F7"], helmet: ["#F5F5F7", "#1E4FD8"], rimColor: "#C9CDD3" },
  // ------------------------------------------------------------------ tier 3
  { id: "mr-sprint-600", name: "Sprint 600", cls: "Supersport 600", tier: 3, stars: 58, style: "sport", desc: "The classic supersport: sharp, fast and loves a long sweeping corner.",
    stats: st(7, 7, 8, 6, 0.52), colors: ["#40C4FF", "#111214", "#F5F5F7"], engine: eng("inline4", 15500, 6, 1500), accent: "#111214", livery: "stripe", suit: ["#40C4FF", "#111214"], helmet: ["#40C4FF", "#F5F5F7"] },
  { id: "mr-easy-chopper", name: "Easy Chopper", cls: "Chopper", tier: 3, stars: 65, style: "chopper", desc: "A raked-out chopper with ape-hanger bars. It's not fast in corners. It does not care.",
    stats: st(7, 5, 3, 6, 0.85), colors: ["#7A1F2B", "#111214", "#FFD400"], engine: eng("twin", 6000, 5, 750), accent: "#FFD400", livery: "stripe", suit: ["#111214", "#7A1F2B"], helmet: ["#7A1F2B", "#C9CDD3"], metal: "#E6E8EC", rimColor: "#E6E8EC" },
  { id: "mr-street-fighter", name: "Street Fighter", cls: "Naked 900", tier: 3, stars: 72, style: "naked", desc: "A superbike with the fairings ripped off. Wild.",
    stats: st(8, 8, 6, 6, 0.6), colors: ["#E10600", "#111214", "#F5F5F7"], engine: eng("inline4", 13500, 6, 1300), suit: ["#E10600", "#111214"], helmet: ["#111214", "#E10600"] },
  { id: "mr-volt-sport", name: "Volt Sport", cls: "Electric Sport", tier: 3, stars: 79, style: "electric", desc: "A silent electric sport bike with a wall of torque.",
    stats: st(8, 9, 7, 6, 0.6), colors: ["#B9FBC0", "#40C4FF", "#F5F5F7"], engine: eng("electric", 16000, 1, 0), accent: "#111214", livery: "split", suit: ["#111214", "#B9FBC0"], helmet: ["#B9FBC0", "#1a1a1a"] },
  { id: "mr-maxi-scooter", name: "Maxi Scooter", cls: "Maxi Scooter", tier: 3, stars: 86, style: "scooter", desc: "A big, comfy scooter that is somehow faster than it looks.",
    stats: st(7, 6, 7, 6, 0.55), colors: ["#C9CDD3", "#111214", "#1E4FD8"], engine: eng("twin", 8500, 1, 1100), accent: "#111214", suit: ["#111214", "#C9CDD3"], helmet: ["#C9CDD3", "#1a1a1a"] },
  { id: "mr-retro-750", name: "Retro 750", cls: "Classic Racer", tier: 3, stars: 93, style: "cafe", desc: "A 70s endurance racer with a round headlight and a howling four.",
    stats: st(8, 7, 6, 6, 0.58), colors: ["#FFD400", "#E10600", "#F5F5F7"], engine: eng("inline4", 11000, 5, 1100), accent: "#E10600", livery: "stripe", suit: ["#FFD400", "#111214"], helmet: ["#F5F5F7", "#E10600"], rimColor: "#C9A44A" },
  { id: "mr-tourer", name: "Highway Tourer", cls: "Tourer", tier: 3, stars: 100, style: "cruiser", desc: "A big touring bike — luxury on two wheels, with a sneaky top speed.",
    stats: st(8, 6, 5, 6, 0.85), colors: ["#1E4FD8", "#C9CDD3", "#111214"], engine: eng("twin", 7000, 6, 900), accent: "#C9CDD3", suit: ["#111214", "#1E4FD8"], helmet: ["#1E4FD8", "#C9CDD3"], metal: "#E6E8EC" },
  // ------------------------------------------------------------------ tier 4
  { id: "mr-superbike", name: "Superbike 1000", cls: "Superbike", tier: 4, stars: 110, style: "sport", desc: "Two hundred horsepower in a machine you can lift with one hand. Hang on!",
    stats: st(9, 8, 8, 7, 0.6), colors: ["#E10600", "#F5F5F7", "#111214"], engine: eng("inline4", 15000, 6, 1400), accent: "#F5F5F7", livery: "split", suit: ["#E10600", "#F5F5F7"], helmet: ["#E10600", "#111214"] },
  { id: "mr-hyper-naked", name: "Hyper Naked", cls: "Hyper Naked", tier: 4, stars: 120, style: "naked", desc: "The most powerful naked bike in the paddock. Wheelies in fifth gear.",
    stats: st(9, 9, 6, 7, 0.62), colors: ["#B98CFF", "#111214", "#FFD400"], engine: eng("inline4", 14000, 6, 1300), suit: ["#111214", "#B98CFF"], helmet: ["#B98CFF", "#FFD400"] },
  { id: "mr-gp-replica", name: "GP Replica", cls: "Race Replica", tier: 4, stars: 130, style: "sport", desc: "Painted like a championship winner. Rides like one too.",
    stats: st(9, 8, 9, 7, 0.55), colors: ["#FFD400", "#1E4FD8", "#F5F5F7"], engine: eng("inline4", 16000, 6, 1500), accent: "#1E4FD8", livery: "split", suit: ["#FFD400", "#1E4FD8"], helmet: ["#FFD400", "#1E4FD8"] },
  { id: "mr-power-cruiser", name: "Power Cruiser", cls: "Power Cruiser", tier: 4, stars: 140, style: "cruiser", desc: "A drag-strip cruiser with a fat rear tyre. Straight-line monster.",
    stats: st(9, 9, 4, 7, 0.9), colors: ["#111214", "#E10600", "#C9CDD3"], engine: eng("twin", 7500, 5, 850), accent: "#E10600", livery: "stripe", suit: ["#111214", "#E10600"], helmet: ["#111214", "#E10600"], metal: "#2a2c31" },
  { id: "mr-volt-hyper", name: "Volt Hyper", cls: "Electric Superbike", tier: 4, stars: 150, style: "electric", desc: "An electric superbike. Silent, brutal, futuristic.",
    stats: st(9, 10, 8, 7, 0.62), colors: ["#40C4FF", "#F5F5F7", "#111214"], engine: eng("electric", 17000, 1, 0), accent: "#F5F5F7", livery: "stripe", suit: ["#40C4FF", "#F5F5F7"], helmet: ["#F5F5F7", "#40C4FF"] },
  { id: "mr-track-sm", name: "Track Supermoto", cls: "Track Supermoto", tier: 4, stars: 160, style: "supermoto", desc: "The supermoto that eats tight circuits for breakfast.",
    stats: st(8, 9, 10, 7, 0.45), colors: ["#FFD400", "#111214", "#1E9C4F"], engine: eng("single", 12500, 6, 1500), accent: "#111214", livery: "split", suit: ["#FFD400", "#111214"], helmet: ["#111214", "#FFD400"] },
  // ------------------------------------------------------------------ tier 5
  { id: "mr-gp-proto", name: "GP Prototype", cls: "GP Prototype", tier: 5, stars: 172, style: "sport", desc: "A full Grand Prix prototype with wings. Only the best riders keep it upright.",
    stats: st(10, 9, 9, 8, 0.55), colors: ["#111214", "#E10600", "#FFD400"], engine: eng("inline4", 17500, 6, 1600), accent: "#E10600", livery: "split", suit: ["#111214", "#E10600"], helmet: ["#E10600", "#FFD400"] },
  { id: "mr-hypersport-r", name: "Hypersport R", cls: "Hypersport", tier: 5, stars: 184, style: "sport", desc: "The road-going rocket. Tucked in, it feels like flying.",
    stats: st(10, 9, 9, 8, 0.58), colors: ["#F5F5F7", "#40C4FF", "#E10600"], engine: eng("inline4", 16500, 6, 1500), accent: "#40C4FF", livery: "stripe", suit: ["#F5F5F7", "#40C4FF"], helmet: ["#F5F5F7", "#40C4FF"] },
  { id: "mr-momo-gp", name: "Momo GP", cls: "Momo's Racer", tier: 5, stars: 196, style: "sport", desc: "Momo's own race bike in orange and teal. It just wants to win.",
    stats: st(10, 10, 9, 8, 0.55), colors: ["#FF8A3D", "#2EC4B6", "#F5F5F7"], engine: eng("inline4", 16800, 6, 1500), accent: "#2EC4B6", livery: "split", suit: ["#FF8A3D", "#2EC4B6"], helmet: ["#FF8A3D", "#2EC4B6"] },
  { id: "mr-dragon-v4", name: "Dragon V4", cls: "V4 Superbike", tier: 5, stars: 208, style: "sport", desc: "A deep-red V4 superbike with a growl like a dragon.",
    stats: st(10, 10, 9, 9, 0.6), colors: ["#B00020", "#111214", "#FFD400"], engine: eng("twin", 15000, 6, 1300), accent: "#111214", livery: "stripe", suit: ["#B00020", "#111214"], helmet: ["#B00020", "#FFD400"] },
  { id: "mr-phantom-e", name: "Phantom E", cls: "Electric Prototype", tier: 5, stars: 222, style: "electric", desc: "An electric prototype from the future. You'll hear the wind, nothing else.",
    stats: st(10, 10, 10, 9, 0.58), colors: ["#111214", "#B98CFF", "#40C4FF"], engine: eng("electric", 18000, 1, 0), accent: "#B98CFF", livery: "split", suit: ["#111214", "#B98CFF"], helmet: ["#111214", "#B98CFF"] },
  { id: "mr-chrome-chopper", name: "Chrome King", cls: "Show Chopper", tier: 5, stars: 236, style: "chopper", desc: "So much chrome you need sunglasses. Surprisingly, terrifyingly fast.",
    stats: st(10, 9, 5, 9, 0.85), colors: ["#C9CDD3", "#111214", "#FFD400"], engine: eng("twin", 7000, 5, 800), accent: "#FFD400", livery: "stripe", suit: ["#111214", "#C9CDD3"], helmet: ["#C9CDD3", "#111214"], metal: "#F0F2F5", rimColor: "#F0F2F5" },
  { id: "mr-moto-king", name: "The Moto King", cls: "Champion's Bike", tier: 5, stars: 256, style: "sport", desc: "Gold and black, number one on the nose. The champion's machine.",
    stats: st(10, 10, 10, 10, 0.55), colors: ["#FFD400", "#111214"], engine: eng("inline4", 18000, 6, 1600), accent: "#111214", livery: "split", suit: ["#FFD400", "#111214"], helmet: ["#FFD400", "#111214"], rimColor: "#FFD400" },
];

export const MOTO_BIKES: CarSpec[] = D.map((d) => {
  const shape: BikeShape = { kind: "bike", style: d.style, ...GEO[d.style], accent: d.accent, livery: d.livery ?? "none", suit: d.suit, helmet: d.helmet, rimColor: d.rimColor, metal: d.metal, exhaust: d.exhaust };
  return { id: d.id, name: d.name, cls: d.cls, tier: d.tier, unlockStars: d.stars, desc: d.desc, stats: d.stats, colors: d.colors, engine: d.engine, model: shape as unknown as Record<string, unknown> };
});
