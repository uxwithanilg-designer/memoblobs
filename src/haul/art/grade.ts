// The colour grade of a stage: the world's palette (blended with a remix partner's), moved to the stage's time of day.
// Far layers fade into the haze for depth; mornings are soft peach, golden hours warm amber, dusks violet-rose,
// nights deep teal-blue with the road still readable. The moon world keeps its own space palette.
import type { StagePlan } from "../stages";
import { worldOf, type TimeOfDay, type Weather, type World } from "../worlds";
import { mix, shade } from "../util";

export interface Look {
  world: World;
  partner: World | null;
  time: TimeOfDay;
  weather: Weather;
  space: boolean;
  sky: [string, string, string];
  sun: string;
  haze: string;
  layers: [string, string, string];
  surface: string; surfaceHi: string; soil: [string, string]; strata: string;
  accent: string; glow: string;
  /** 0 day … 1 night: windows, lamps, glows and stars come up with it */
  night: number;
  /** sun / moon height (0 horizon … 1 top) and side (0 left … 1 right) */
  sunY: number; sunX: number;
  light: string;
  tint: string; tintAmt: number;
  /** fog strength 0..1 (weather) */
  fog: number;
}

const TIME: Record<TimeOfDay, { sky: [string, string, string]; tint: string; amt: number; dark: number; light: string; sunY: number; w: number }> = {
  morning: { sky: ["#79A8E6", "#C9D9F0", "#FFD9BE"], tint: "#FFC2A0", amt: 0.1, dark: 0.02, light: "#FFE3C8", sunY: 0.28, w: 0.55 },
  day: { sky: ["#4E9FF2", "#8CCBFF", "#E2F4FF"], tint: "#FFFFFF", amt: 0, dark: 0, light: "#FFFBEA", sunY: 0.8, w: 0 },
  golden: { sky: ["#4A63B0", "#F0A06C", "#FFD898"], tint: "#FF9448", amt: 0.2, dark: 0.07, light: "#FFCF88", sunY: 0.2, w: 0.72 },
  dusk: { sky: ["#252A68", "#A85C9C", "#FF9E7C"], tint: "#7A4AA8", amt: 0.26, dark: 0.22, light: "#FFB4A0", sunY: 0.06, w: 0.8 },
  night: { sky: ["#071026", "#10224E", "#21407A"], tint: "#1A3070", amt: 0.4, dark: 0.48, light: "#BCD6FF", sunY: 0.74, w: 0.86 },
};
const DEPTH_HAZE = [0.5, 0.25, 0.08];

export function lookFor(plan: StagePlan): Look {
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const b = partner ? plan.blendAmt : 0;
  const P = (a: string, k: string | undefined) => (partner && k ? mix(a, k, b) : a);
  const tm = TIME[plan.time];
  const space = !!world.space;
  // glowcap's own sky is already a night sky: time only nudges it
  const ownNight = world.id === "glowcap" || world.id === "ember";
  const wsky = world.sky.map((c, i) => P(c, partner?.sky[i])) as [string, string, string];
  const pull = space ? 0 : ownNight ? tm.w * 0.25 : tm.w;
  const sky = wsky.map((c, i) => mix(c, tm.sky[i], pull)) as [string, string, string];
  const haze = space ? world.haze : mix(P(world.haze, partner?.haze), sky[2], 0.45 * pull + 0.2);
  const tint = tm.tint, amt = space ? 0.08 : ownNight ? tm.amt * 0.4 : tm.amt, dark = space ? 0.12 : ownNight ? tm.dark * 0.4 : tm.dark;
  const grade = (c: string, depth: number) => {
    let x = mix(c, haze, DEPTH_HAZE[depth] ?? 0);
    x = mix(x, tint, amt * (0.6 + 0.4 * (depth === 0 ? 0 : 1)));
    return dark > 0 ? shade(x, -dark * (0.85 - depth * 0.1)) : x;
  };
  const layers = world.layers.map((c, i) => grade(P(c, partner?.layers[i]), i)) as [string, string, string];
  const g0 = (c: string) => (dark > 0 ? shade(mix(c, tint, amt * 0.5), -dark * 0.5) : mix(c, tint, amt * 0.5));
  const night = space ? 0.9 : world.id === "glowcap" ? 0.85 : plan.time === "night" ? 1 : plan.time === "dusk" ? 0.45 : plan.time === "golden" ? 0.12 : world.id === "ember" ? 0.35 : 0;
  const fog = plan.weather === "fog" ? 0.7 : plan.weather === "rain" || plan.weather === "snow" ? 0.3 : plan.weather === "dust" ? 0.45 : 0;
  return {
    world, partner, time: plan.time, weather: plan.weather, space,
    sky, sun: plan.time === "night" && !space ? "#F2F0FF" : world.sun, haze,
    layers,
    surface: g0(P(world.surface, partner?.surface)), surfaceHi: g0(P(world.surfaceHi, partner?.surfaceHi)),
    soil: [g0(P(world.soil[0], partner?.soil[0])), g0(P(world.soil[1], partner?.soil[1]))],
    strata: world.id === "ember" ? world.strata : g0(P(world.strata, partner?.strata)),
    accent: world.accent, glow: world.glow,
    night, sunY: space ? 0.6 : tm.sunY, sunX: 0.74 - (plan.seed % 7) * 0.04,
    light: world.id === "glowcap" ? "#C8B8FF" : tm.light, tint, tintAmt: amt, fog,
  };
}
